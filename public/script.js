// Link Tracker JavaScript

// Tab functionality
function showTab(tabName) {
    console.log('showTab called with:', tabName);
    
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
        console.log('Hiding tab content:', content.id);
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('bg-indigo-500', 'text-white');
        tab.classList.add('text-gray-600', 'hover:text-gray-900');
    });
    
    // Show selected tab content
    const tabContent = document.getElementById(tabName + '-tab');
    console.log('Tab content element:', tabContent);
    if (tabContent) {
        tabContent.classList.remove('hidden');
        console.log('Showing tab content:', tabContent.id);
    } else {
        console.error('Tab content not found for:', tabName + '-tab');
    }
    
    // Add active class to clicked tab
    if (event && event.target) {
        event.target.classList.remove('text-gray-600', 'hover:text-gray-900');
        event.target.classList.add('bg-indigo-500', 'text-white');
    }
    
    // Load links if switching to manage tab
    if (tabName === 'manage') {
        console.log('Loading links for manage tab');
        loadLinks();
    }
}

// Create link form
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, setting up event listeners');
    
    // Set up tab switching with event delegation
    const tabsContainer = document.querySelector('.flex.justify-center.mb-8');
    console.log('Tabs container found:', tabsContainer);
    if (tabsContainer) {
        tabsContainer.addEventListener('click', function(e) {
            console.log('Tab clicked:', e.target);
            console.log('Target classes:', e.target.classList);
            if (e.target.classList.contains('tab')) {
                const tabName = e.target.getAttribute('data-tab');
                console.log('Tab name:', tabName);
                showTab(tabName);
            }
        });
    } else {
        console.error('Tabs container not found!');
    }
    
    // Set up copy button
    document.addEventListener('click', function(e) {
        if (e.target.id === 'copyBtn' || e.target.closest('#copyBtn')) {
            copyToClipboard();
        }
    });
    
    // Check if Tailwind is loaded
    setTimeout(() => {
        if (!document.querySelector('[class*="bg-gradient"]')) {
            console.warn('Tailwind CSS may not be loaded properly');
        }
    }, 1000);
    
    const createLinkForm = document.getElementById('createLinkForm');
    if (createLinkForm) {
        console.log('Create link form found');
        createLinkForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const originalUrl = document.getElementById('originalUrl').value;
            const title = document.getElementById('linkTitle').value;
            
            // Show loading state
            const submitBtn = createLinkForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Creating...';
            submitBtn.disabled = true;
            
            try {
                const response = await fetch('/api/links', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        original_url: originalUrl,
                        title: title
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    document.getElementById('trackableUrl').textContent = data.trackable_url;
                    document.getElementById('linkResult').classList.remove('hidden');
                    document.getElementById('createLinkForm').reset();
                    
                    // Show success animation
                    document.getElementById('linkResult').classList.add('animate-pulse');
                    setTimeout(() => {
                        document.getElementById('linkResult').classList.remove('animate-pulse');
                    }, 1000);
                } else {
                    showNotification('Error: ' + data.error, 'error');
                }
            } catch (error) {
                showNotification('Error creating link: ' + error.message, 'error');
            } finally {
                // Reset button
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    } else {
        console.log('Create link form not found');
    }
});

// Copy to clipboard
function copyToClipboard() {
    const url = document.getElementById('trackableUrl').textContent;
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('copyBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check mr-1"></i>Copied!';
        btn.classList.add('bg-green-600');
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('bg-green-600');
        }, 2000);
    });
}

// Load all links
async function loadLinks() {
    console.log('loadLinks function called');
    try {
        const response = await fetch('/api/links');
        const links = await response.json();
        console.log('Links loaded:', links);
        
        const container = document.getElementById('linksContainer');
        console.log('Container element:', container);
        
        if (links.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-link text-gray-400 text-xl"></i>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">No links created yet</h3>
                    <p class="text-gray-500 mb-6">Create your first trackable link to start monitoring</p>
                    <button onclick="showTab('create')" class="bg-indigo-500 text-white px-6 py-2 rounded-lg hover:bg-indigo-600 transition-colors">
                        <i class="fas fa-plus mr-2"></i>Create Your First Link
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                ${links.map(link => `
                    <div class="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow min-h-[280px] flex flex-col">
                        <div class="flex items-start justify-between mb-4">
                            <div class="flex-1 min-w-0">
                                <h3 class="text-lg font-semibold text-gray-900 mb-2 break-words">${link.title}</h3>
                                <div class="mb-2">
                                    <p class="text-xs text-gray-500 mb-1">Original URL:</p>
                                    <div class="bg-gray-50 rounded-lg p-3 border">
                                        <p class="text-xs text-gray-700 break-all font-mono leading-relaxed">${link.original_url}</p>
                                    </div>
                                </div>
                            </div>
                            <div class="ml-3 flex-shrink-0">
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    ${link.total_clicks} clicks
                                </span>
                            </div>
                        </div>
                        
                        <div class="space-y-3 mb-4 flex-grow">
                            <div class="flex items-center text-sm text-gray-600">
                                <i class="fas fa-calendar mr-2 text-gray-400 flex-shrink-0"></i>
                                <span class="truncate">Created ${new Date(link.created_at).toLocaleDateString()}</span>
                            </div>
                            <div class="flex items-center text-sm text-gray-600">
                                <i class="fas fa-link mr-2 text-gray-400 flex-shrink-0"></i>
                                <span class="font-mono text-xs bg-gray-100 px-2 py-1 rounded">${link.short_code}</span>
                            </div>
                            <div class="flex items-center text-sm text-gray-600">
                                <i class="fas fa-external-link-alt mr-2 text-gray-400 flex-shrink-0"></i>
                                <span class="truncate">Trackable: ${window.location.origin}/r/${link.short_code}</span>
                            </div>
                        </div>
                        
                        <div class="flex space-x-2 mt-auto">
                            <button class="view-analytics-btn flex-1 bg-indigo-500 text-white px-3 py-2 rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium" data-link-id="${link.id}">
                                <i class="fas fa-chart-bar mr-1"></i>Analytics
                            </button>
                            <button class="delete-link-btn bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors text-sm font-medium" data-link-id="${link.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Set up event listeners for dynamically created buttons
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('view-analytics-btn') || e.target.closest('.view-analytics-btn')) {
                const linkId = e.target.getAttribute('data-link-id') || e.target.closest('.view-analytics-btn').getAttribute('data-link-id');
                viewAnalytics(linkId);
            }
            
            if (e.target.classList.contains('delete-link-btn') || e.target.closest('.delete-link-btn')) {
                const linkId = e.target.getAttribute('data-link-id') || e.target.closest('.delete-link-btn').getAttribute('data-link-id');
                deleteLink(linkId);
            }
        });
        
    } catch (error) {
        console.error('Error loading links:', error);
        let errorMessage = 'Failed to load links';
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Unable to connect to server. Please check your connection.';
        } else if (error.message.includes('500')) {
            errorMessage = 'Server error. Database may not be available.';
        }
        
        document.getElementById('linksContainer').innerHTML = `
            <div class="text-center py-12">
                <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-exclamation-triangle text-red-500 text-xl"></i>
                </div>
                <h3 class="text-lg font-medium text-gray-900 mb-2">Error loading links</h3>
                <p class="text-gray-500 mb-4">${errorMessage}</p>
                <button onclick="loadLinks()" class="bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition-colors">
                    <i class="fas fa-redo mr-2"></i>Retry
                </button>
            </div>
        `;
    }
}

// View analytics
async function viewAnalytics(linkId) {
    console.log('viewAnalytics called with:', linkId);
    try {
        const response = await fetch(`/api/links/${linkId}/analytics`);
        const data = await response.json();
        
        if (response.ok) {
            showAnalyticsModal(data);
        } else {
            showNotification('Error: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('Error loading analytics: ' + error.message, 'error');
    }
}

// Show analytics modal
function showAnalyticsModal(data) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div class="p-6 border-b border-gray-200">
                <div class="flex items-center justify-between">
                    <h3 class="text-xl font-bold text-gray-900">Analytics for "${data.link.title}"</h3>
                    <button class="close-modal-btn text-gray-400 hover:text-gray-600 text-2xl">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="p-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div class="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl p-6">
                        <div class="text-3xl font-bold mb-2">${data.analytics.totalClicks}</div>
                        <div class="text-indigo-100">Total Clicks</div>
                    </div>
                    <div class="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-6">
                        <div class="text-3xl font-bold mb-2">${data.analytics.uniqueVisitors}</div>
                        <div class="text-green-100">Unique Visitors</div>
                    </div>
                </div>
                
                ${data.analytics.referrers.length > 0 ? `
                    <div class="bg-gray-50 rounded-xl p-6 mb-6">
                        <h4 class="text-lg font-semibold text-gray-900 mb-4">
                            <i class="fas fa-external-link-alt mr-2 text-indigo-500"></i>Top Referrers
                        </h4>
                        <div class="space-y-3">
                            ${data.analytics.referrers.map(([domain, count]) => `
                                <div class="flex items-center justify-between p-3 bg-white rounded-lg">
                                    <span class="font-medium text-gray-900">${domain}</span>
                                    <span class="text-sm text-gray-500">${count} clicks</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${data.analytics.countries.length > 0 ? `
                    <div class="bg-gray-50 rounded-xl p-6 mb-6">
                        <h4 class="text-lg font-semibold text-gray-900 mb-4">
                            <i class="fas fa-globe mr-2 text-indigo-500"></i>Top Countries
                        </h4>
                        <div class="space-y-3">
                            ${data.analytics.countries.map(([country, count]) => `
                                <div class="flex items-center justify-between p-3 bg-white rounded-lg">
                                    <span class="font-medium text-gray-900">${country}</span>
                                    <span class="text-sm text-gray-500">${count} clicks</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="bg-gray-50 rounded-xl p-6">
                    <h4 class="text-lg font-semibold text-gray-900 mb-4">
                        <i class="fas fa-clock mr-2 text-indigo-500"></i>Recent Clicks
                    </h4>
                    <div class="space-y-3 max-h-64 overflow-y-auto">
                        ${data.analytics.recentClicks.map(click => `
                            <div class="p-3 bg-white rounded-lg">
                                <div class="flex items-center justify-between text-sm">
                                    <span class="text-gray-900">${new Date(click.clicked_at).toLocaleString()}</span>
                                    <span class="text-gray-500">${click.country || 'Unknown'}</span>
                                </div>
                                <div class="text-xs text-gray-500 mt-1">${click.ip_address}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set up close button event listener
    modal.querySelector('.close-modal-btn').addEventListener('click', function() {
        modal.remove();
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Delete link
async function deleteLink(linkId) {
    if (!confirm('Are you sure you want to delete this link? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/links/${linkId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Link deleted successfully', 'success');
            loadLinks(); // Reload the links
        } else {
            const data = await response.json();
            showNotification('Error: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('Error deleting link: ' + error.message, 'error');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 translate-x-full`;
    
    const colors = {
        success: 'bg-green-500 text-white',
        error: 'bg-red-500 text-white',
        info: 'bg-blue-500 text-white'
    };
    
    notification.className += ` ${colors[type]}`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    // Animate out and remove
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
} 