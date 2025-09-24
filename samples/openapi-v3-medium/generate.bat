@echo off
REM OpenAPI v3 Medium Sample Generation Script (Windows)
REM This script generates TypeScript client from the medium complexity OpenAPI v3 specification

echo 🚀 Generating TypeScript client from OpenAPI v3 Medium specification
echo ==================================================================

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..\..

REM Input and output paths
set SPEC_FILE=%SCRIPT_DIR%openapi-v3-medium.yaml
set OUTPUT_DIR=%SCRIPT_DIR%generated

echo 📄 Input spec: %SPEC_FILE%
echo 📁 Output directory: %OUTPUT_DIR%
echo.

REM Check if spec file exists
if not exist "%SPEC_FILE%" (
    echo ❌ Error: OpenAPI spec file not found: %SPEC_FILE%
    exit /b 1
)

REM Create output directory if it doesn't exist
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM Change to project root to run the CLI
cd /d "%PROJECT_ROOT%"

REM Run the generation command
echo 🔧 Running openapi-to-ts generate...
npx openapi-to-ts generate "%SPEC_FILE%" ^
    --output "%OUTPUT_DIR%" ^
    --namespace "MediumAPI" ^
    --axios-instance "mediumApiClient" ^
    --type-output "file-per-type"

echo.
echo ✅ Generation completed successfully!
echo 📁 Generated files are in: %OUTPUT_DIR%
echo.
echo 📋 Generated files:
dir "%OUTPUT_DIR%"
