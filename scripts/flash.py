"""
FlowPad 一键构建 → 编译 → 烧录 → 上传文件系统
用法: python scripts/flash.py

可选参数:
  --no-upload    只构建+编译，不烧录
  --no-fs        只烧录固件，不上传文件系统
  --monitor      烧录后打开串口监视
"""

import subprocess
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run(cmd, name):
    """运行命令，失败时退出"""
    print(f"\n{'='*50}")
    print(f"  [{name}]")
    print(f"{'='*50}")
    result = subprocess.run(cmd, shell=True, cwd=ROOT)
    if result.returncode != 0:
        print(f"\n[ERROR] {name} 失败 (退出码 {result.returncode})")
        sys.exit(1)
    print(f"[OK] {name} 完成")


def main():
    upload    = '--no-upload'  not in sys.argv
    upload_fs = '--no-fs'      not in sys.argv
    monitor   = '--monitor'     in sys.argv

    # 1. 构建前端
    run('python scripts/build.py', '前端构建')

    # 2. 编译固件
    run('pio run', '编译固件')

    # 3. 烧录固件
    if upload:
        run('pio run --target upload', '烧录固件')

    # 4. 上传文件系统
    if upload_fs:
        run('pio run --target uploadfs', '上传文件系统')

    print(f"\n{'='*50}")
    print("  全部完成!")
    print(f"{'='*50}")

    # 5. 串口监视
    if monitor:
        print("\n启动串口监视 (Ctrl+C 退出)...")
        subprocess.run('pio device monitor', shell=True, cwd=ROOT)


if __name__ == '__main__':
    main()
