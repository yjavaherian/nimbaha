// Global variables
let ipList = new Set();
let ipv4Count = 0;
let ipv6Count = 0;

// DOM elements
const urlInput = document.getElementById('urlInput');
const checkBtn = document.getElementById('checkBtn');
const resultDiv = document.getElementById('result');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const totalIPsElement = document.getElementById('totalIPs');
const lastUpdateElement = document.getElementById('lastUpdate');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadIPList();
    loadHistory();
    
    // Event listeners
    checkBtn.addEventListener('click', checkURL);
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkURL();
    });
    clearHistoryBtn.addEventListener('click', clearHistory);
});

/**
 * Load IP list from ips.txt file
 */
async function loadIPList() {
    try {
        const response = await fetch('ips.txt');
        if (!response.ok) throw new Error('Failed to load IP list');
        
        const text = await response.text();
        const ips = text.split('\n')
            .map(ip => ip.trim())
            .filter(ip => ip.length > 0);
        
        ipList = new Set(ips);
        
        // Count IPv4 and IPv6
        ipv4Count = 0;
        ipv6Count = 0;
        ips.forEach(ip => {
            if (ip.includes(':')) {
                ipv6Count++;
            } else {
                ipv4Count++;
            }
        });
        
        // Update stats
        totalIPsElement.textContent = ipList.size.toLocaleString('fa-IR');
        
        // Get last modified date
        const lastModified = response.headers.get('last-modified');
        if (lastModified) {
            const date = new Date(lastModified);
            lastUpdateElement.textContent = date.toLocaleDateString('fa-IR');
        }
    } catch (error) {
        console.error('Error loading IP list:', error);
        showResult('خطا در بارگذاری لیست IP ها', 'error');
    }
}

/**
 * Extract domain from URL
 */
function extractDomain(input) {
    try {
        // Remove protocol if exists
        let domain = input.trim();
        domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
        
        // Remove path, query, and fragment
        domain = domain.split('/')[0];
        domain = domain.split('?')[0];
        domain = domain.split('#')[0];
        
        // Remove port if exists
        domain = domain.split(':')[0];
        
        return domain;
    } catch (error) {
        return null;
    }
}

/**
 * Resolve domain to IP using DNS-over-HTTPS
 */
async function resolveIP(domain) {
    try {
        // Try multiple DNS-over-HTTPS providers for A (IPv4) and AAAA (IPv6) records
        const providers = [
            `https://cloudflare-dns.com/dns-query?name=${domain}`,
            `https://dns.google/resolve?name=${domain}`
        ];

        for (const provider of providers) {
            try {
                // Check for both A and AAAA records
                const aResponse = await fetch(`${provider}&type=A`);
                const aaaaResponse = await fetch(`${provider}&type=AAAA`);

                if (!aResponse.ok && !aaaaResponse.ok) {
                    continue; // Try next provider if both fail
                }

                const aData = aResponse.ok ? await aResponse.json() : { Answer: [] };
                const aaaaData = aaaaResponse.ok ? await aaaaResponse.json() : { Answer: [] };

                const answers = (aData.Answer || []).concat(aaaaData.Answer || []);

                if (answers.length > 0) {
                    // Prefer IPv4 if available, otherwise use IPv6
                    const ipv4 = answers.find(ans => ans.type === 1); // 1 for A record
                    if (ipv4) return ipv4.data;
                    
                    const ipv6 = answers.find(ans => ans.type === 28); // 28 for AAAA record
                    if (ipv6) return ipv6.data;
                }
            } catch (error) {
                console.warn(`DNS provider ${provider} failed:`, error);
                continue; // Try next provider
            }
        }
        
        return null; // No IP found from any provider
    } catch (error) {
        console.error('Error resolving IP:', error);
        return null;
    }
}

/**
 * Check if URL/domain is discounted
 */
async function checkURL() {
    const input = urlInput.value.trim();
    
    if (!input) {
        showResult('لطفاً یک لینک یا دامنه وارد کنید', 'error');
        return;
    }
    
    // Show loading state
    setLoading(true);
    
    try {
        // Extract domain
        const domain = extractDomain(input);
        
        if (!domain) {
            showResult('لینک یا دامنه نامعتبر است', 'error');
            return;
        }
        
        // Resolve IP
        const ip = await resolveIP(domain);
        
        if (!ip) {
            showResult('خطا در دریافت IP. لطفاً دوباره تلاش کنید.', 'error');
            return;
        }
        
        // Check if IP is in discounted list
        const isDiscounted = ipList.has(ip);
        
        // Show result
        if (isDiscounted) {
            showResult(
                `✅ این لینک تخفیف دارد!`,
                'success',
                `دامنه: ${domain}<br>IP: <code>${ip}</code><br>با دانلود از این لینک ۶۳٪ تخفیف اعمال می‌شود.`
            );
        } else {
            showResult(
                `❌ این لینک تخفیف ندارد`,
                'error',
                `دامنه: ${domain}<br>IP: <code>${ip}</code><br>دانلود از این لینک به صورت عادی محاسبه می‌شود.`
            );
        }
        
        // Save to history
        saveToHistory(input, domain, ip, isDiscounted);
        
    } catch (error) {
        console.error('Error checking URL:', error);
        showResult('خطایی رخ داد. لطفاً دوباره تلاش کنید.', 'error');
    } finally {
        setLoading(false);
    }
}

/**
 * Show result message
 */
function showResult(title, type, details = '') {
    const typeClasses = {
        success: 'bg-green-100 text-green-800 border border-green-200',
        error: 'bg-red-100 text-red-800 border border-red-200',
        info: 'bg-blue-100 text-blue-800 border border-blue-200'
    };
    
    resultDiv.className = `result mt-4 p-4 rounded-lg text-center ${typeClasses[type] || typeClasses['info']}`;
    resultDiv.innerHTML = `
        <div class="font-bold">${title}</div>
        ${details ? `<div class="text-sm mt-1">${details}</div>` : ''}
    `;
    resultDiv.classList.remove('hidden');
}

/**
 * Set loading state
 */
function setLoading(loading) {
    checkBtn.disabled = loading;
    const icon = checkBtn.querySelector('i');
    const loader = checkBtn.querySelector('.loader');
    const btnText = checkBtn.querySelector('span:first-child');

    if (loading) {
        if (icon) icon.classList.add('hidden');
        if (btnText) btnText.classList.add('hidden');
        loader.classList.remove('hidden');
    } else {
        if (icon) icon.classList.remove('hidden');
        if (btnText) btnText.classList.remove('hidden');
        loader.classList.add('hidden');
    }
}

/**
 * Save check to history (localStorage)
 */
function saveToHistory(url, domain, ip, isDiscounted) {
    const history = getHistory();
    
    const entry = {
        url,
        domain,
        ip,
        isDiscounted,
        timestamp: Date.now()
    };
    
    // Add to beginning of array
    history.unshift(entry);
    
    // Keep only last 20 entries
    if (history.length > 20) {
        history.pop();
    }
    
    localStorage.setItem('checkHistory', JSON.stringify(history));
    renderHistory();
}

/**
 * Get history from localStorage
 */
function getHistory() {
    const stored = localStorage.getItem('checkHistory');
    return stored ? JSON.parse(stored) : [];
}

/**
 * Load and render history
 */
function loadHistory() {
    renderHistory();
    const history = getHistory();
    if (history.length === 0) {
        clearHistoryBtn.classList.add('hidden');
    }
}

/**
 * Render history list
 */
function renderHistory() {
    const history = getHistory();
    
    if (history.length === 0) {
        historyList.innerHTML = '<p class="empty-history text-center text-slate-500 py-4">هنوز بررسی‌ای انجام نشده است</p>';
        clearHistoryBtn.classList.add('hidden');
        return;
    }
    
    clearHistoryBtn.classList.remove('hidden');

    historyList.innerHTML = history.map(entry => {
        const statusClass = entry.isDiscounted ? 'text-green-600' : 'text-red-600';
        const statusIcon = entry.isDiscounted ? 'check-circle' : 'x-circle';
        const time = new Date(entry.timestamp).toLocaleString('fa-IR');

        return `
            <div class="p-3 border-b border-slate-100 last:border-b-0 flex justify-between items-center gap-4">
                <div class="flex items-center gap-3">
                    <i data-lucide="${statusIcon}" class="w-5 h-5 ${statusClass}"></i>
                    <div>
                        <div class="font-semibold truncate" title="${entry.url}">${entry.domain}</div>
                        <div class="text-sm text-slate-500">${entry.ip || 'N/A'}</div>
                    </div>
                </div>
                <div class="text-xs text-slate-400 text-left whitespace-nowrap">${time}</div>
            </div>
        `;
    }).join('');
    
    // After rendering, create the icons
    lucide.createIcons();
}

/**
 * Clear history
 */
function clearHistory() {
    if (confirm('آیا مطمئن هستید که می‌خواهید تاریخچه را پاک کنید؟')) {
        localStorage.removeItem('checkHistory');
        renderHistory();
    }
}
