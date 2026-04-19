// Email 页面 JavaScript

const emailListEl = document.getElementById('emailList');
const emailViewEl = document.getElementById('emailView');
const replySection = document.getElementById('replySection');
const replyForm = document.getElementById('replyForm');
const cancelReplyBtn = document.getElementById('cancelReply');
const messageDiv = document.getElementById('message');
const networkStatusEl = document.getElementById('networkStatus');

let currentEmails = [];
let selectedEmailId = null;

// 加载邮件列表
async function loadEmails() {
  emailListEl.innerHTML = '<div class="loading">正在加载邮件...</div>';
  
  try {
    const response = await fetch('/api/email');
    const data = await response.json();
    
    if (data.success) {
      currentEmails = data.emails;
      renderEmailList(data.emails);
      updateNetworkStatus(data.network_quality);
    } else {
      emailListEl.innerHTML = `<div class="empty-state">加载失败：${data.error}</div>`;
    }
  } catch (error) {
    emailListEl.innerHTML = `<div class="empty-state">加载失败：${error.message}<br>网络连接可能已中断</div>`;
    updateNetworkStatus('lost');
  }
}

// 渲染邮件列表
function renderEmailList(emails) {
  if (emails.length === 0) {
    emailListEl.innerHTML = '<div class="empty-state">收件箱为空</div>';
    return;
  }
  
  emailListEl.innerHTML = emails.map(email => `
    <div class="email-item ${email.is_read ? '' : 'unread'}" data-id="${email.id}">
      <h4>${escapeHtml(email.subject || '(无主题)')}</h4>
      <p>${escapeHtml(email.body.substring(0, 50))}${email.body.length > 50 ? '...' : ''}</p>
      <div class="meta">
        来自：${escapeHtml(email.sender)} | 
        ${formatDate(email.created_at)}
      </div>
    </div>
  `).join('');
  
  // 添加点击事件
  document.querySelectorAll('.email-item').forEach(item => {
    item.addEventListener('click', () => selectEmail(parseInt(item.dataset.id)));
  });
}

// 选择邮件
async function selectEmail(emailId) {
  selectedEmailId = emailId;
  
  try {
    // 标记为已读
    await fetch(`/api/email/read/${emailId}`, { method: 'PUT' });
    
    const email = currentEmails.find(e => e.id === emailId);
    if (email) {
      renderEmailView(email);
    }
  } catch (error) {
    console.error('标记已读失败:', error);
  }
}

// 渲染邮件详情
function renderEmailView(email) {
  emailViewEl.innerHTML = `
    <h3>${escapeHtml(email.subject || '(无主题)')}</h3>
    <div class="meta">
      <div><strong>发件人:</strong> ${escapeHtml(email.sender)}</div>
      <div><strong>收件人:</strong> ${escapeHtml(email.recipient)}</div>
      <div><strong>时间:</strong> ${formatDate(email.created_at)}</div>
      ${email.metadata ? `<div><strong>元数据:</strong> <code>${JSON.stringify(email.metadata)}</code></div>` : ''}
    </div>
    <div class="body">${escapeHtml(email.body)}</div>
  `;
  
  // 显示回复表单
  document.getElementById('replySubject').value = `Re: ${email.subject || '(无主题)'}`;
  replySection.style.display = 'block';
}

// 发送邮件
replyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const subject = document.getElementById('replySubject').value;
  const body = document.getElementById('replyBody').value;
  
  const sendBtn = replyForm.querySelector('button[type="submit"]');
  sendBtn.disabled = true;
  sendBtn.textContent = '发送中...';
  
  try {
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showMessage('邮件已发送！' + (data.network_delay > 3000 ? '（延迟较高）' : ''), 'success');
      replyForm.reset();
      replySection.style.display = 'none';
      
      // 重新加载邮件列表
      setTimeout(() => loadEmails(), 1000);
    } else {
      showMessage('发送失败：' + data.error, 'error');
    }
  } catch (error) {
    showMessage('发送失败：' + error.message, 'error');
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = '发送';
  }
});

// 取消回复
cancelReplyBtn.addEventListener('click', () => {
  replySection.style.display = 'none';
  replyForm.reset();
});

// 更新网络状态显示
function updateNetworkStatus(quality) {
  const statusMap = {
    'good': '🟢 良好',
    'fair': '🟡 一般',
    'poor': '🔴 较差',
    'lost': '⚫ 中断'
  };
  
  networkStatusEl.textContent = `网络状态：${statusMap[quality] || '未知'}`;
}

// 显示消息
function showMessage(text, type) {
  messageDiv.textContent = text;
  messageDiv.className = `message show ${type}`;
  
  setTimeout(() => {
    messageDiv.classList.remove('show');
  }, 5000);
}

// 工具函数：转义 HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 工具函数：格式化日期
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN');
}

// 页面加载时获取邮件
loadEmails();

// 定期刷新邮件列表（每 30 秒）
setInterval(loadEmails, 30000);
