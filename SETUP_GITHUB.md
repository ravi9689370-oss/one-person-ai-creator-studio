# Setup GitHub Repository

## Initialize and Push

```bash
cd /root/one-person-ai-creator-studio
git init
git add .
git commit -m "Initial commit: Nexora AI Super App"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nexora-ai.git
git push -u origin main
```

## GitHub Actions
The workflow at `.github/workflows/build-apk.yml` will automatically build APK on push. Download from Actions artifacts.
