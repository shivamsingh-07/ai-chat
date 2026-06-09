pipeline {
    agent any

    tools {
        nodejs 'node-24-lts'
    }

    environment {
        NAMESPACE = 'chat-app'
        IMAGE = 'abstergo07/ai-chat'
        IMAGE_TAG = "${env.BUILD_NUMBER}"
        API_URL = credentials('k8s-api-server')
        DISCORD_WEBHOOK = credentials('discord-webhook')
    }

    stages {
        stage('Install Dependencies') {
            when {
                changeset 'app/**'
            }
            steps {
                sh 'yarn install --frozen-lockfile > build.log 2>&1'
            }
        }

        stage('Quality Checks') {
            when {
                changeset 'app/**'
            }
            parallel {
                stage('Lint') {
                    steps {
                        sh 'yarn lint >> build.log 2>&1'
                    }
                }
                stage('Test') {
                    steps {
                        sh 'yarn test >> build.log 2>&1'
                    }
                }
            }
        }

        stage('Build Image') {
            when {
                changeset 'app/**'
            }
            steps {
                sh 'docker build -t "$IMAGE:$IMAGE_TAG" -t "$IMAGE:latest" . > build.log 2>&1'
            }
        }

        stage('Security Scan') {
            when {
                changeset 'app/**'
            }
            steps {
                sh './scripts/security-scan.sh "$IMAGE:$IMAGE_TAG" > build.log 2>&1'
                archiveArtifacts artifacts: 'trivy-report.log'
                script {
                    env.SCAN_VERDICT = sh(script: 'grep -q "VERDICT: PASS" trivy-report.log', returnStatus: true) == 0 ? 'PASS' : 'FAIL'
                    if (env.SCAN_VERDICT == 'FAIL') {
                        error('Vulnerability scan failed — see trivy-report.log for details')
                    }
                }
            }
        }

        stage('Push Image') {
            when {
                changeset 'app/**'
            }
            steps {
                withDockerRegistry(credentialsId: 'dockerhub-login', url: 'https://index.docker.io/v1/') {
                    sh 'docker push "$IMAGE:$IMAGE_TAG" > build.log 2>&1'
                    sh 'docker push "$IMAGE:latest" >> build.log 2>&1'
                }
            }
        }

        stage('Deploy Kubernetes Manifests') {
            when {
                anyOf {
                    changeset 'app/**'
                    changeset 'kubernetes/**'
                }
            }
            steps {
                withKubeConfig(credentialsId: 'jenkins-token', serverUrl: env.API_URL) {
                    sh '''
                        kubectl apply -n "$NAMESPACE" -f kubernetes/ > build.log 2>&1
                        kubectl rollout status -n "$NAMESPACE" deploy/ai-chat --timeout=300s >> build.log 2>&1
                    '''
                }
            }
        }
    }

    post {
        success {
            discordSend title: 'AI-Chat Pipeline Report',
            description: "✅ Pipeline succeeded.",
            footer: "Build #${env.BUILD_NUMBER}",
            link: env.BUILD_URL,
            result: 'SUCCESS',
            webhookURL: env.DISCORD_WEBHOOK
        }

        failure {
            script {
                def description
                def logFile = env.SCAN_VERDICT == 'FAIL' ? 'trivy-report.log' : 'build.log'
                withCredentials([string(credentialsId: 'gemini-api-key', variable: 'GEMINI_API_KEY')]) {
                    def out = sh(
                        script: 'python3 scripts/analyze-logs.py --api-key "$GEMINI_API_KEY" --log build.log',
                        returnStdout: true,
                    ).trim()
                    def analysis = readJSON text: out
                    if (analysis.error) {
                        description = "❌ Pipeline failed. Log analysis unavailable: ${analysis.error}"
                    } else {
                        description = "❌ Pipeline failed.\n\n**Root Cause:** ${analysis.cause}\n\n**Suggested Fix:** ${analysis.fix}"
                    }
                }

                discordSend title: 'AI-Chat Pipeline Report',
                description: description,
                footer: "Build #${env.BUILD_NUMBER}",
                customFile: logFile,
                link: env.BUILD_URL,
                result: 'FAILURE',
                webhookURL: env.DISCORD_WEBHOOK
            }
        }

        cleanup {
            cleanWs()
        }
    }
}
