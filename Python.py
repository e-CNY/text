import os
import sys
import subprocess
import shutil

# 强制切换到脚本所在目录
os.chdir(os.path.dirname(os.path.abspath(__file__)))

INPUT_FOLDER = '.'       
OUTPUT_FOLDER = 'output_wasm' 

# 定义要查找的可执行文件名称
EXECUTABLES = {
    'wasm-opt': 'wasm-opt.exe' if os.name == 'nt' else 'wasm-opt',
    'brotli': 'brotli.exe' if os.name == 'nt' else 'brotli'
}

def find_executable(tool_name):
    """优先在当前目录找 exe，找不到再去系统路径找"""
    local_exe = os.path.join(os.getcwd(), EXECUTABLES[tool_name])
    if os.path.exists(local_exe):
        return local_exe
    # 如果本地没有，看看系统环境变量里有没有
    system_exe = shutil.which(tool_name)
    if system_exe:
        return system_exe
    return None

def check_environment():
    missing = []
    paths = {}
    for tool in ['wasm-opt', 'brotli']:
        path = find_executable(tool)
        if path:
            paths[tool] = path
        else:
            missing.append(EXECUTABLES[tool])
            
    if missing:
        print("==================================================")
        print("❌ 运行失败：找不到以下核心工具！")
        print(f"   缺少: {', '.join(missing)}")
        print("💡 解决办法：")
        print("   请把下载好的 wasm-opt.exe 和 brotli.exe 直接放到")
        print("   当前文件夹（和本脚本、待处理文件放在一起）。")
        print("==================================================")
        return False, None
    return True, paths

def process_wasm(tool_paths):
    if not os.path.exists(OUTPUT_FOLDER):
        os.makedirs(OUTPUT_FOLDER)

    wasm_files = [f for f in os.listdir(INPUT_FOLDER) if f.endswith('.wasm')]
    
    if not wasm_files:
        print("❌ 当前文件夹下没找到任何 .wasm 文件！")
        print("💡 请把原版 .wasm 文件和本脚本放在同一个文件夹下。")
        return

    print(f"找到 {len(wasm_files)} 个 Wasm 文件，准备开始处理...\n")

    for filename in wasm_files:
        base_name = filename.replace('.wasm', '')
        input_path = os.path.join(INPUT_FOLDER, filename)
        opt_path = os.path.join(OUTPUT_FOLDER, f"{base_name}.min.wasm")
        br_path = f"{opt_path}.br"

        print(f"🚀 正在处理: {filename}")
        original_size = os.path.getsize(input_path) / 1024 / 1024
        print(f"📦 原始体积: {original_size:.2f} MB")

        # 步骤 1: wasm-opt 极限优化
        try:
            subprocess.run([tool_paths['wasm-opt'], '-Oz', '--strip-debug', input_path, '-o', opt_path], check=True)
            opt_size = os.path.getsize(opt_path) / 1024 / 1024
            print(f"✨ wasm-opt 优化后: {opt_size:.2f} MB")
        except Exception as e:
            print(f"❌ wasm-opt 优化失败: {e}")
            continue

        # 步骤 2: Brotli 极限压缩
        print("🗜️ 正在进行 Brotli 极限压缩 (11级)...")
        try:
            subprocess.run([tool_paths['brotli'], '-q', '11', '-o', br_path, opt_path], check=True)
            br_size = os.path.getsize(br_path) / 1024 / 1024
            print(f"🚀 压缩完成: {br_size:.2f} MB")
        except Exception as e:
            print(f"❌ brotli 压缩失败: {e}")
            continue

        # 步骤 3: 生成前端代码
        js_code = generate_js_loader(base_name, os.path.basename(br_path))
        js_path = os.path.join(OUTPUT_FOLDER, f"{base_name}_loader.js")
        with open(js_path, 'w', encoding='utf-8') as f:
            f.write(js_code)
        print(f"✅ 已生成前端加载器: {base_name}_loader.js\n")

    print("🎉 全部处理完成！请查看 output_wasm 文件夹。")

def generate_js_loader(lib_name, br_file_name):
    safe_name = lib_name.replace('-', '_')
    return f"""// 自动生成: {lib_name} 的加载器
async function init_{safe_name}() {{
    console.log("正在下载并解压 {lib_name} 引擎...");
    const response = await fetch('./wasm/{br_file_name}');
    const compressedBuffer = await response.arrayBuffer();
    
    // 内存解压
    const wasmModule = await Brotli.decompress(new Uint8Array(compressedBuffer));
    
    // 实例化
    const {{ instance }} = await WebAssembly.instantiate(wasmModule.buffer, {{
        env: {{}} // 此处需根据具体库调整
    }});

    return instance.exports;
}}
"""

if __name__ == "__main__":
    print("==================================================")
    print("       🚀 WASM 极限压缩一键处理工具")
    print("==================================================")
    print("正在检查系统环境...")
    
    is_ready, tool_paths = check_environment()
    if is_ready:
        print("环境检查通过！开始执行任务...\n")
        try:
            process_wasm(tool_paths)
        except Exception as e:
            print(f"\n❌ 发生未知严重错误: {e}")
    
    print("\n==================================================")
    input("处理结束，请按 [回车键] 退出窗口...")