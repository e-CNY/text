(function () {
  const logEl = document.getElementById('log');
  const btnFetch = document.getElementById('btn-fetch');
  const btnClear = document.getElementById('btn-clear');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  function log(msg, type = 'info') {
    let cls = 'log-info';
    if (type === 'error') cls = 'log-error';
    if (type === 'success') cls = 'log-success';
    logEl.innerHTML += `<div class="${cls}">> ${msg}</div>`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  // 核心：通用 WASM 实例化探测器
  async function testWasmInstance(arrayBuffer, sourceName) {
    try {
      log(`正在实例化 WASM 引擎...`);
      // 使用空环境实例化，绝大多数不需要特殊环境的 wasm 都能通过
      const { instance } = await WebAssembly.instantiate(arrayBuffer, {});
      
      log(`✅ 加载成功 [${sourceName}]！`, 'success');
      
      // 1. 探测内存 (Memory)
      if (instance.exports.memory) {
        const memMB = (instance.exports.memory.buffer.byteLength / 1024 / 1024).toFixed(2);
        log(`📦 发现内部内存分配: ${memMB} MB`);
      }

      // 2. 探测导出的 API
      const exports = Object.keys(instance.exports).filter(k => k !== 'memory');
      if (exports.length > 0) {
        log(`🔧 导出的 API 列表 (共 ${exports.length} 个):`);
        // 把 API 分成每行 5 个打印，防止刷屏
        let apiStr = '';
        exports.forEach((name, index) => {
          apiStr += `[${name}] `;
          if ((index + 1) % 5 === 0) apiStr += '\n';
        });
        log(apiStr);
      } else {
        log(`⚠️ 该 WASM 文件没有导出任何可调用的 API。`);
      }

      // 如果你确实想测试那个加法函数，可以在这里保留
      if (instance.exports.add) {
        const result = instance.exports.add(5, 6);
        log(`✅ 专项测试 add(5, 6) = ${result}`, 'success');
      }

    } catch (e) {
      log(`❌ 实例化失败 [${sourceName}]: ${e.message}`, 'error');
      log(`提示：如果该 WASM 需要特定的 importObject，空环境 {} 会导致报错。这是正常现象。`, 'error');
    }
  }

  // 处理文件的核心逻辑
  async function processBuffer(arrayBuffer, fileName) {
    if (fileName.endsWith('.br')) {
      log(`检测到 .br 压缩包，准备解压...`);
      try {
        log(`正在加载本地 Brotli 解压引擎...`);
        const brotliModule = await import('./js/libs/brotli-wasm/brotli_wasm.js');
        await brotliModule.default(); 
        
        const compressedData = new Uint8Array(arrayBuffer);
        const decompressed = brotliModule.decompress(compressedData);
        
        log(`✅ 解压成功！压缩大小: ${(compressedData.length/1024).toFixed(2)} KB -> 解压后: ${(decompressed.length/1024).toFixed(2)} KB`, 'success');
        await testWasmInstance(decompressed.buffer, fileName);
      } catch (err) {
        console.error(err);
        log(`❌ 解压失败: ${err.message}`, 'error');
      }
    } else if (fileName.endsWith('.wasm')) {
      log(`检测到原版 .wasm，直接准备实例化...`);
      await testWasmInstance(arrayBuffer, fileName);
    } else {
      log(`❌ 未知文件类型: ${fileName}`, 'error');
    }
  }

  // 线上 Fetch 和 拖拽 逻辑保持不变...
  btnFetch.addEventListener('click', async () => {
    logEl.innerHTML = '';
    log('开始线上 Fetch 测试...');
    const brUrl = './wasm/demo.wasm.br';
    const rawUrl = './wasm/demo.wasm';
    try {
      const brRes = await fetch(brUrl);
      if (brRes.ok) {
        await processBuffer(await brRes.arrayBuffer(), 'demo.wasm.br');
        return;
      }
    } catch (e) {}
    try {
      const rawRes = await fetch(rawUrl);
      if (rawRes.ok) await processBuffer(await rawRes.arrayBuffer(), 'demo.wasm');
    } catch (e) {}
  });

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', function() {
    if (this.files.length > 0) handleFile(this.files[0]);
    this.value = '';
  });

  function handleFile(file) {
    logEl.innerHTML = '';
    log(`已选择文件: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    if (file.size === 0) return log(`❌ 警告：该文件大小为 0 字节！`, 'error');
    const reader = new FileReader();
    reader.onload = async (e) => await processBuffer(e.target.result, file.name);
    reader.readAsArrayBuffer(file);
  }

  btnClear.addEventListener('click', () => { logEl.innerHTML = '等待操作...'; });
})();