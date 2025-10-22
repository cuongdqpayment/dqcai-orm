import { execSync } from 'child_process';
import { exit } from 'process';
import { readFileSync } from 'fs';

// Màu sắc cho terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Hàm log với màu sắc
function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step: number, message: string): void {
  log(`\n${'='.repeat(60)}`, colors.cyan);
  log(`📦 BƯỚC ${step}: ${message}`, colors.bright + colors.blue);
  log('='.repeat(60), colors.cyan);
}

function logSuccess(message: string): void {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string): void {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message: string): void {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message: string): void {
  log(`ℹ️  ${message}`, colors.cyan);
}

// Hàm thực thi lệnh với log
function runCommand(command: string, description: string, silent: boolean = false): string {
  try {
    if (!silent) {
      log(`\n🔧 Đang thực hiện: ${description}`, colors.cyan);
      log(`   Lệnh: ${command}`, colors.reset);
    }
    
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: silent ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe']
    });
    
    const outputStr = output ? output.toString().trim() : '';
    
    if (outputStr && !silent) {
      log(`   📄 Output: ${outputStr}`, colors.reset);
    }
    
    if (!silent) {
      logSuccess(`${description} - Hoàn thành!`);
    }
    
    return outputStr;
  } catch (error: any) {
    logError(`${description} - Thất bại!`);
    if (error.stderr) {
      log(`   Chi tiết lỗi: ${error.stderr.toString().trim()}`, colors.red);
    }
    if (error.stdout) {
      log(`   Output: ${error.stdout.toString().trim()}`, colors.reset);
    }
    if (error.message) {
      log(`   Message: ${error.message}`, colors.red);
    }
    throw error;
  }
}

// Lấy nhánh hiện tại
function getCurrentBranch(): string {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const branchName = branch ? branch.toString().trim() : '';
    log(`📍 Nhánh hiện tại: ${branchName}`, colors.yellow);
    return branchName;
  } catch (error) {
    logError('Không thể lấy thông tin nhánh hiện tại');
    throw error;
  }
}

// Kiểm tra có thay đổi chưa commit không
function hasUncommittedChanges(): boolean {
  try {
    const status = execSync('git status --porcelain', { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const statusStr = status ? status.toString().trim() : '';
    return statusStr.length > 0;
  } catch (error) {
    return false;
  }
}

// Lấy version hiện tại từ package.json
function getCurrentVersion(): string {
  try {
    const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
    return packageJson.version;
  } catch (error) {
    logError('Không thể đọc version từ package.json');
    throw error;
  }
}

// Kiểm tra đã đăng nhập npm chưa
function checkNpmLogin(): boolean {
  try {
    execSync('npm whoami', { 
      encoding: 'utf-8', 
      stdio: ['pipe', 'pipe', 'pipe'] 
    });
    return true;
  } catch (error) {
    return false;
  }
}

// Kiểm tra nhánh có tồn tại không
function branchExists(branchName: string): boolean {
  try {
    execSync(`git rev-parse --verify ${branchName}`, { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    return true;
  } catch (error) {
    return false;
  }
}

// Main function
async function release(versionType: 'patch' | 'minor' | 'major'): Promise<void> {
  log('\n' + '🚀'.repeat(30), colors.bright + colors.green);
  log('🚀  BẮT ĐẦU QUY TRÌNH RELEASE NPM PACKAGE  🚀', colors.bright + colors.green);
  log('🚀'.repeat(30) + '\n', colors.bright + colors.green);
  
  log(`📌 Loại version: ${versionType.toUpperCase()}`, colors.bright);
  log(`⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}`, colors.bright);

  let currentBranch = '';
  let originalVersion = '';
  
  try {
    // Kiểm tra điều kiện ban đầu
    logStep(0, 'Kiểm tra điều kiện ban đầu');
    
    // Lưu nhánh hiện tại
    currentBranch = getCurrentBranch();
    
    // Kiểm tra phải đang ở nhánh develop
    if (currentBranch !== 'develop') {
      logError('Script này phải chạy từ nhánh develop!');
      logInfo(`Bạn đang ở nhánh: ${currentBranch}`);
      logInfo('Vui lòng chuyển sang nhánh develop: git checkout develop');
      exit(1);
    }
    logSuccess('Đang ở nhánh develop');
    
    // Kiểm tra nhánh release có tồn tại không
    if (!branchExists('release')) {
      logError('Nhánh release không tồn tại!');
      logInfo('Vui lòng tạo nhánh release: git checkout -b release');
      exit(1);
    }
    logSuccess('Nhánh release đã tồn tại');
    
    // Kiểm tra đã đăng nhập npm chưa
    if (!checkNpmLogin()) {
      logError('Chưa đăng nhập npm!');
      logInfo('Vui lòng đăng nhập: npm login');
      exit(1);
    }
    const npmUser = runCommand('npm whoami', 'Kiểm tra tài khoản npm', true);
    logSuccess(`Đã đăng nhập npm với tài khoản: ${npmUser}`);
    
    // Lưu version hiện tại
    originalVersion = getCurrentVersion();
    logInfo(`Version hiện tại: v${originalVersion}`);

    // BƯỚC 1: Commit và push code từ nhánh develop
    logStep(1, 'Commit và push code từ nhánh develop');
    
    if (hasUncommittedChanges()) {
      logWarning('Phát hiện có thay đổi chưa được commit');
      runCommand('git add .', 'Add tất cả thay đổi');
      runCommand(
        `git commit -m "chore: prepare for release ${versionType}"`, 
        'Commit các thay đổi'
      );
    } else {
      logInfo('Không có thay đổi cần commit');
    }
    
    runCommand('git push origin develop', 'Push nhánh develop lên repository');

    // BƯỚC 2: Checkout sang nhánh release và merge develop
    logStep(2, 'Checkout sang nhánh release và merge develop');
    runCommand('git checkout release', 'Chuyển sang nhánh release');
    runCommand('git merge develop --no-edit', 'Merge develop vào release');

    // BƯỚC 3: Tăng version
    logStep(3, `Tăng version (${versionType})`);
    runCommand(`npm version ${versionType} --no-git-tag-version`, `Tăng version ${versionType}`);
    
    // Lấy version mới
    const newVersion = getCurrentVersion();
    logSuccess(`Version mới: v${newVersion}`);

    // BƯỚC 4: Chạy prepublishOnly (clean, build, mã hóa)
    logStep(4, 'Chạy prepublishOnly (clean, build, mã hóa)');
    log('⏳ Đang chạy prepublishOnly... (có thể mất vài phút)', colors.yellow);
    runCommand('npm run prepublishOnly', 'Clean, build và mã hóa code');

    // BƯỚC 5: Publish lên npm
    logStep(5, 'Publish package lên npm');
    log('⏳ Đang publish lên npm...', colors.yellow);
    
    // Commit thay đổi version trước khi publish
    runCommand('git add .', 'Add thay đổi version');
    runCommand(
      `git commit -m "chore: release v${newVersion}"`, 
      'Commit version mới'
    );
    
    // Tạo git tag
    runCommand(`git tag v${newVersion}`, 'Tạo git tag cho version mới');
    
    // Publish lên npm
    runCommand('npm publish', 'Publish package lên npm registry');
    
    logSuccess(`Package đã được publish thành công với version v${newVersion}`);

    // BƯỚC 6: Push lên repository
    logStep(6, 'Push thay đổi lên repository');
    runCommand('git push origin release', 'Push nhánh release');
    runCommand('git push origin --tags', 'Push tags lên repository');

    // BƯỚC 7: Checkout về nhánh develop
    logStep(7, 'Checkout về nhánh develop');
    runCommand('git checkout develop', 'Chuyển về nhánh develop');
    
    // Merge release vào develop để đồng bộ version
    logInfo('Đồng bộ version mới vào nhánh develop');
    runCommand('git merge release --no-edit', 'Merge release vào develop');
    runCommand('git push origin develop', 'Push develop lên repository');

    // Thành công
    log('\n' + '🎉'.repeat(30), colors.bright + colors.green);
    log('🎉  RELEASE THÀNH CÔNG!  🎉', colors.bright + colors.green);
    log('🎉'.repeat(30) + '\n', colors.bright + colors.green);
    
    log(`✨ Package: ${readFileSync('./package.json', 'utf-8').match(/"name":\s*"([^"]+)"/)?.[1]}`, colors.bright + colors.green);
    log(`✨ Version cũ: v${originalVersion} → Version mới: v${newVersion}`, colors.bright + colors.green);
    log(`✨ Nhánh release đã được push lên repository với tag v${newVersion}`, colors.bright + colors.green);
    log(`✨ Package đã được publish lên npm registry`, colors.bright + colors.green);
    log(`✨ Bạn đang ở nhánh: develop`, colors.bright + colors.green);
    
    log(`\n💡 Bạn có thể kiểm tra package tại:`, colors.cyan);
    log(`   https://www.npmjs.com/package/${readFileSync('./package.json', 'utf-8').match(/"name":\s*"([^"]+)"/)?.[1]}`, colors.cyan);

  } catch (error: any) {
    logError('\n❌ QUY TRÌNH RELEASE THẤT BẠI!');
    log(`Chi tiết lỗi: ${error.message}`, colors.red);
    
    // Rollback về nhánh develop nếu có lỗi
    if (currentBranch) {
      try {
        log('\n🔄 Đang rollback về nhánh develop...', colors.yellow);
        execSync('git checkout develop', { 
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        logSuccess('Đã quay về nhánh develop');
        
        // Reset version nếu đã thay đổi
        const currentVersion = getCurrentVersion();
        if (currentVersion !== originalVersion && originalVersion) {
          logWarning('Đang reset version về trạng thái ban đầu...');
          execSync(`npm version ${originalVersion} --no-git-tag-version`, { 
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
          });
          logSuccess(`Đã reset version về v${originalVersion}`);
        }
      } catch (rollbackError) {
        logError('Không thể rollback tự động. Vui lòng kiểm tra thủ công!');
        logInfo('Các bước khắc phục thủ công:');
        logInfo('1. git checkout develop');
        logInfo('2. Kiểm tra và sửa file package.json nếu cần');
        logInfo('3. Xóa tag nếu đã tạo: git tag -d v<version> && git push origin :refs/tags/v<version>');
      }
    }
    
    exit(1);
  }
}

// Lấy tham số từ command line
const versionType = process.argv[2] as 'patch' | 'minor' | 'major';

if (!versionType || !['patch', 'minor', 'major'].includes(versionType)) {
  logError('Vui lòng chỉ định loại version: patch, minor, hoặc major');
  log('\n📖 Cách sử dụng:', colors.yellow);
  log('   npm run release:patch  - Tăng version patch (v1.0.0 → v1.0.1)', colors.cyan);
  log('   npm run release:minor  - Tăng version minor (v1.0.0 → v1.1.0)', colors.cyan);
  log('   npm run release:major  - Tăng version major (v1.0.0 → v2.0.0)', colors.cyan);
  exit(1);
}

// Chạy quy trình release
release(versionType);