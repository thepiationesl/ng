// Setup 页面 JavaScript

const setupForm = document.getElementById('setupForm');
const initSection = document.getElementById('initSection');
const initWorldBtn = document.getElementById('initWorldBtn');
const statusSection = document.getElementById('statusSection');
const statusContent = document.getElementById('statusContent');
const messageDiv = document.getElementById('message');
const styleWeightInput = document.getElementById('styleWeight');
const styleWeightValue = document.getElementById('styleWeightValue');

// 更新风格权重显示
styleWeightInput.addEventListener('input', () => {
  styleWeightValue.textContent = styleWeightInput.value;
});

// 加载当前状态
async function loadStatus() {
  try {
    const response = await fetch('/api/setup/status');
    const data = await response.json();
    
    if (data.success) {
      renderStatus(data);
      
      // 如果已配置 API 但未初始化世界，显示初始化按钮
      if (data.api_configured && !data.setup_completed) {
        initSection.style.display = 'block';
      }
    }
  } catch (error) {
    showMessage('加载状态失败：' + error.message, 'error');
  }
}

// 渲染状态
function renderStatus(data) {
  const statusItems = [
    { label: '设置完成', value: data.setup_completed ? '✅ 是' : '❌ 否' },
    { label: 'API 已配置', value: data.api_configured ? '✅ 是' : '❌ 否' },
    { label: '国家 ID', value: data.country_id || '未生成' }
  ];
  
  statusContent.innerHTML = statusItems.map(item => `
    <div class="status-item">
      <span class="status-label">${item.label}</span>
      <span class="status-value">${item.value}</span>
    </div>
  `).join('');
}

// 保存配置
setupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(setupForm);
  const config = Object.fromEntries(formData.entries());
  
  try {
    const response = await fetch('/api/setup/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    const data = await response.json();
    
    if (data.success) {
      showMessage('配置已保存！', 'success');
      loadStatus();
      initSection.style.display = 'block';
    } else {
      showMessage('保存失败：' + data.error, 'error');
    }
  } catch (error) {
    showMessage('保存失败：' + error.message, 'error');
  }
});

// 初始化世界
initWorldBtn.addEventListener('click', async () => {
  initWorldBtn.disabled = true;
  initWorldBtn.textContent = '生成中...';
  
  try {
    const response = await fetch('/api/setup/initialize', {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.success) {
      showMessage(`世界生成成功！\n\n国家：${data.country.name}\n政府类型：${data.country.government_type}\n设备数量：${data.devices_count}`, 'success');
      initWorldBtn.textContent = '✅ 世界已生成';
      loadStatus();
    } else {
      showMessage('生成失败：' + data.error, 'error');
      initWorldBtn.disabled = false;
      initWorldBtn.textContent = '🌍 生成世界';
    }
  } catch (error) {
    showMessage('生成失败：' + error.message, 'error');
    initWorldBtn.disabled = false;
    initWorldBtn.textContent = '🌍 生成世界';
  }
});

// 显示消息
function showMessage(text, type) {
  messageDiv.textContent = text;
  messageDiv.className = `message show ${type}`;
  
  setTimeout(() => {
    messageDiv.classList.remove('show');
  }, 5000);
}

// 页面加载时获取状态
loadStatus();
