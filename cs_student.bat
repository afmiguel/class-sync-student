@echo off
setlocal

:: --- CONFIGURACOES - Edite se necessario ---
set "GITHUB_USER=afmiguel"
set "EXTENSION_ID=SeuPublisher.class-sync-student"
set "EXTENSION_URL=https://arquivos.afonso.prof/class-sync-student-0.0.1.vsix"
set "VSIX_FILENAME=class-sync-student.vsix"
:: -----------------------------------------

echo ==========================================================
echo    Configurador de Ambiente de Aula - Class Sync
echo ==========================================================
echo.

:: Passo 1: Pedir o nome do repositório ao aluno
set /p REPO_NAME="Digite o nome do repositorio da aula e pressione Enter: "

if "%REPO_NAME%"=="" (
    echo.
    echo [ERRO] Nenhum nome de repositorio foi digitado.
    goto :end
)

:: --- NOVO PASSO DE VERIFICACAO ---
echo.
echo [+] Verificando se o repositorio '%REPO_NAME%' existe no GitHub...
set "REPO_URL=https://github.com/%GITHUB_USER%/%REPO_NAME%.git"

:: O comando 'git ls-remote' verifica o repositório. Se ele não existir, o comando falhará.
:: Redirecionamos a saída para 'nul' para não poluir a tela.
git ls-remote "%REPO_URL%" >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Repositorio '%REPO_NAME%' nao encontrado no GitHub.
    echo Verifique se voce digitou o nome corretamente.
    goto :end
)

echo [INFO] Repositorio encontrado. Prosseguindo com a configuracao...
:: --- FIM DO NOVO PASSO DE VERIFICACAO ---

:: Passo 2: Criar o diretório e clonar o projeto
if exist "%REPO_NAME%" (
    echo.
    echo [AVISO] A pasta '%REPO_NAME%' ja existe. O script nao fara nada.
    goto :end
)

echo.
echo [+] Criando a pasta '%REPO_NAME%'...
mkdir "%REPO_NAME%"
cd "%REPO_NAME%"

echo [+] Baixando o projeto do professor...
git clone "%REPO_URL%" .
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao clonar o repositorio.
    cd ..
    rmdir "%REPO_NAME%"
    goto :end
)

echo [+] Projeto baixado com sucesso!
echo.

:: Passo 3: Verificar e instalar a extensão do VS Code
echo [+] Verificando a extensao Class Sync - Student...

code --list-extensions | findstr /I /C:"%EXTENSION_ID%" >nul
if %errorlevel% equ 0 (
    echo [INFO] A extensao ja esta instalada.
) else (
    echo [INFO] A extensao nao foi encontrada. Instalando agora...
    
    echo [+] Baixando o instalador da extensao...
    powershell -Command "Invoke-WebRequest -Uri '%EXTENSION_URL%' -OutFile '%VSIX_FILENAME%'"
    
    if not exist "%VSIX_FILENAME%" (
        echo [ERRO] Falha ao baixar a extensao. Verifique a URL e sua conexao.
        goto :end
    )
    
    echo [+] Instalando...
    code --install-extension "%VSIX_FILENAME%" --wait
    
    echo [+] Limpando arquivos temporarios...
    del "%VSIX_FILENAME%"
    
    echo [+] Extensao instalada com sucesso!
)

:: Passo 4: Abrir o projeto no VS Code
echo.
echo ==========================================================
echo    Configuracao concluida! Abrindo o VS Code...
echo ==========================================================
code .

:end
echo.
pause