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
                sh 'yarn install --frozen-lockfile'
            }
        }

        stage('Quality Checks') {
            when {
                changeset 'app/**'
            }
            parallel {
                stage('Lint') {
                    steps {
                        sh 'yarn lint'
                    }
                }
                stage('Test') {
                    steps {
                        sh 'yarn test'
                    }
                }
            }
        }

        stage('Build Image') {
            when {
                changeset 'app/**'
            }
            steps {
                sh 'docker build -t "$IMAGE:$IMAGE_TAG" -t "$IMAGE:latest" .'
            }
        }

        stage('Security Scan') {
            when {
                changeset 'app/**'
            }
            steps {
                sh './scripts/security-scan.sh "$IMAGE:$IMAGE_TAG"'
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
                    sh 'docker push "$IMAGE:$IMAGE_TAG"'
                    sh 'docker push "$IMAGE:latest"'
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
                        kubectl create namespace "$NAMESPACE" 2>/dev/null || true
                        kubectl apply -n "$NAMESPACE" -f kubernetes/
                        kubectl rollout status -n "$NAMESPACE" deploy/ai-chat --timeout=300s
                    '''
                }
            }
        }
    }

    post {
        always {
            script {
                def result = currentBuild.currentResult
                def description
                if (result == 'SUCCESS') {
                    description = "✅ Pipeline succeeded. Image ${env.IMAGE}:${env.IMAGE_TAG} pushed."
                } else if (env.SCAN_VERDICT == 'FAIL') {
                    description = "🛑 Blocked: Trivy found HIGH/CRITICAL vulnerabilities in ${env.IMAGE}:${env.IMAGE_TAG}. Image was not pushed — see the attached trivy-report.log."
                } else {
                    description = "❌ Pipeline failed at a build/deploy step. Check the console log: ${env.BUILD_URL}console"
                }

                discordSend title: 'AI-Chat Pipeline Report',
                description: description,
                footer: "Build #${env.BUILD_NUMBER}",
                customFile: 'trivy-report.log',
                link: env.BUILD_URL,
                result: result,
                webhookURL: env.DISCORD_WEBHOOK
            }
            cleanWs()
        }
    }
}
