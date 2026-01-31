import { escapeHtml, validateDate, isPastDate } from './utils.js';
import { getTasks, saveTasks, getCategories, saveCategories, getTheme, saveTheme, getLastResetDate, saveLastResetDate, getBackupConfig, saveBackupConfig, getGitHubToken, saveGitHubToken } from './storage.js';

class TodoApp {
    constructor() {
        this.tasks = getTasks();
        this.categories = getCategories();
        this.currentFilter = 'all';
        this.currentSort = 'created';
        this.sortOrder = 'desc';
        this.lastResetDate = getLastResetDate();
        this.resetTimer = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkDailyReset();
        this.renderTasks();
        this.renderCategories();
        this.updateHeaderDate();
        this.loadTheme();
        this.updateSortButtons();
        
        // 添加定时器，每分钟检查一次每日任务重置
        this.resetTimer = setInterval(() => {
            this.checkDailyReset();
        }, 60000); // 60000ms = 1分钟
    }

    cleanup() {
        if (this.resetTimer) {
            clearInterval(this.resetTimer);
            this.resetTimer = null;
        }
    }

    checkDailyReset() {
        const today = new Date().toDateString();
        if (this.lastResetDate !== today) {
            this.resetDailyTasks();
            this.lastResetDate = today;
            saveLastResetDate(today);
        }
    }

    resetDailyTasks() {
        let resetCount = 0;
        this.tasks.forEach(task => {
            if (task.daily && task.completed) {
                task.completed = false;
                resetCount++;
            }
        });
        if (resetCount > 0) {
            this.saveTasks();
        }
    }

    updateHeaderDate() {
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        document.getElementById('current-date').textContent = new Date().toLocaleDateString('zh-CN', options);
    }

    showToast(message, type = 'info', duration = 3000) {
        // 优化：添加空检查
        const container = document.getElementById('toast-container');
        if (!container) {
            console.warn('Toast container not found');
            return;
        }
        
        // 优化：限制同时显示的toast数量
        const existingToasts = container.querySelectorAll('div');
        if (existingToasts.length >= 3) {
            existingToasts[0].remove();
        }
        
        const toast = document.createElement('div');
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            info: 'bg-blue-500',
            warning: 'bg-yellow-500'
        };
        const color = colors[type] || colors.info;
        
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            info: 'info-circle',
            warning: 'exclamation-triangle'
        };
        const icon = icons[type] || icons.info;

        toast.className = `${color} text-white px-5 py-3 rounded-xl shadow-xl text-sm animate-slide-in flex items-center gap-2`;
        toast.innerHTML = `<i class="fa fa-${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);
        
        // 优化：添加清除按钮
        const closeButton = document.createElement('button');
        closeButton.className = 'ml-auto text-white/80 hover:text-white transition-colors';
        closeButton.innerHTML = '<i class="fa fa-times"></i>';
        closeButton.addEventListener('click', () => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        });
        toast.appendChild(closeButton);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    bindEvents() {
        // 添加键盘事件监听器
        document.addEventListener('keydown', (e) => {
            // 按下 Enter 键时，聚焦添加任务输入框
            if (e.key === 'Enter' && !e.target.closest('input') && !e.target.closest('textarea') && !e.target.closest('button')) {
                const taskInput = document.getElementById('task-input');
                if (taskInput) {
                    taskInput.focus();
                }
            }
            
            // 按下 Ctrl+F 键时，聚焦搜索任务输入框
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault(); // 阻止默认的搜索行为
                const searchInput = document.getElementById('search-input');
                if (searchInput) {
                    searchInput.focus();
                }
            }
        });
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');
                this.currentFilter = target.dataset.filter;
                document.getElementById('view-title').textContent = target.innerText.trim();
                this.renderTasks();
                
                // 当点击视图分类时，折叠所有自定义分类的子分类
                const customCategories = document.getElementById('custom-categories');
                if (customCategories) {
                    customCategories.querySelectorAll('.subcategories').forEach(sub => {
                        sub.classList.remove('expanded');
                    });
                }
            });
        });

        document.getElementById('add-category').addEventListener('click', () => this.showCategoryForm());
        document.getElementById('save-category').addEventListener('click', (e) => {
            e.stopPropagation();
            this.saveCategory();
        });
        document.getElementById('cancel-category').addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideCategoryForm();
        });
        document.getElementById('category-name').addEventListener('keypress', (e) => { e.key === 'Enter' && this.saveCategory(); });
        document.getElementById('category-name').addEventListener('blur', (e) => {
            const relatedTarget = e.relatedTarget;
            if (!relatedTarget || 
                !relatedTarget.closest('#category-form')) {
                setTimeout(() => this.hideCategoryForm(), 200);
            }
        });
        const categoryForm = document.getElementById('category-form');
        categoryForm.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        const dateInput = document.getElementById('task-due-date');
        dateInput.addEventListener('click', (e) => {
            if ('showPicker' in HTMLInputElement.prototype) {
                try {
                    e.target.showPicker();
                } catch (err) {
                    console.error("Picker error:", err);
                }
            }
        });

        document.getElementById('add-task').addEventListener('click', () => this.addTask());
        document.getElementById('task-input').addEventListener('keypress', (e) => e.key === 'Enter' && this.addTask());
        document.getElementById('search-input').addEventListener('input', () => this.renderTasks());
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sortType = e.currentTarget.dataset.sort;
                
                if (this.currentSort === sortType) {
                    this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
                } else {
                    this.currentSort = sortType;
                    this.sortOrder = 'desc';
                }
                
                this.updateSortButtons();
                this.renderTasks();
            });
        });

        document.getElementById('task-list').addEventListener('click', (e) => {
            const taskEl = e.target.closest('[id^="task-"]');
            if (!taskEl) return;
            const id = taskEl.id.replace('task-', '');
            if (e.target.closest('.delete-task')) this.deleteTask(id);
            if (e.target.closest('.edit-task')) this.editTask(id);
            if (e.target.closest('.task-checkbox')) this.toggleStatus(id);
        });

        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('clear-completed').addEventListener('click', () => this.clearCompleted());
        document.getElementById('export-tasks').addEventListener('click', () => this.exportTasks());
        document.getElementById('import-tasks').addEventListener('click', () => document.getElementById('import-file').click());
        document.getElementById('import-file').addEventListener('change', (e) => this.importTasks(e));
        document.getElementById('backup-tasks').addEventListener('click', () => this.performBackup());
        document.getElementById('settings-tasks').addEventListener('click', () => this.showBackupDialog());
        
        document.getElementById('confirm-cancel').addEventListener('click', () => this.hideConfirmDialog());
        document.getElementById('confirm-delete').addEventListener('click', () => this.confirmDeleteCategory());
        
        document.getElementById('confirm-dialog').addEventListener('click', (e) => {
            if (e.target === document.getElementById('confirm-dialog')) {
                this.hideConfirmDialog();
            }
        });
        
        // 使用事件委托处理备份对话框中的按钮点击事件
        document.addEventListener('click', (e) => {
            // 备份对话框取消按钮
            if (e.target.closest('#backup-cancel')) {
                this.hideBackupDialog();
            }
            
            // 备份对话框保存按钮
            if (e.target.closest('#backup-save')) {
                this.saveBackupConfig();
                this.hideBackupDialog();
            }
            
            // GitHub 授权按钮
            if (e.target.closest('#github-auth')) {
                this.authorizeGitHub();
            }
        });
    }

    addTask() {
        const input = document.getElementById('task-input');
        const dateInput = document.getElementById('task-due-date');
        const text = input.value.trim();
        const dueDate = dateInput.value;

        if (!text) return;

        if (dueDate) {
            // 更严格的日期格式验证
            const dateValueInput = document.getElementById('task-due-date-value');
            const actualDateValue = dateValueInput.value;
            
            if (actualDateValue) {
                // 验证日期格式为 YYYY-MM-DD
                if (!validateDate(actualDateValue)) {
                    this.showToast('日期格式错误', 'error');
                    dateInput.classList.add('animate-shake');
                    setTimeout(() => dateInput.classList.remove('animate-shake'), 400);
                    return;
                }
                
                // 验证日期是否为过去的日期
                if (isPastDate(actualDateValue)) {
                    this.showToast('不能选择过去的日期', 'error');
                    dateInput.classList.add('animate-shake');
                    setTimeout(() => dateInput.classList.remove('animate-shake'), 400);
                    return;
                }
            }
        }

        let category = null;
        const activeFilterBtn = document.querySelector('.filter-btn.active');
        if (activeFilterBtn && activeFilterBtn.dataset.filter.startsWith('category-')) {
            category = activeFilterBtn.dataset.filter.replace('category-', '');
            if (category.includes('-')) {
                category = category.split('-')[0];
            }
        }
        
        // 从切换按钮获取每日任务状态
        const dailyToggle = document.getElementById('task-daily');
        const isDailyTask = dailyToggle.classList.contains('active');
        
        const task = {
            id: Date.now().toString(),
            text,
            completed: false,
            priority: document.getElementById('task-priority').value,
            dueDate,
            tags: document.getElementById('task-tag').value.split(/[,，]/).map(t => t.trim()).filter(t => t),
            category: category,
            daily: isDailyTask,
            createdAt: new Date().toISOString()
        };

        this.tasks.unshift(task);
        this.saveAndRender();
        
        input.value = '';
        dateInput.value = '';
        document.getElementById('task-tag').value = '';
        // 重置每日任务切换按钮
        dailyToggle.classList.remove('active');
        this.showToast('任务已记录', 'success');
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.saveAndRender();
        this.showToast('已删除任务');
    }

    editTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;
        
        const taskEl = document.getElementById(`task-${id}`);
        if (!taskEl) return;
        
        const textEl = taskEl.querySelector('p');
        if (!textEl) return;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = task.text;
        input.className = 'flex-1 px-2 py-1 bg-transparent border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary font-semibold';
        input.style.minWidth = '100px';
        
        const textContainer = textEl.parentElement;
        textContainer.replaceChild(input, textEl);
        
        input.focus();
        
        input.addEventListener('blur', () => this.saveTaskEdit(id, input, textEl));
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveTaskEdit(id, input, textEl);
            } else if (e.key === 'Escape') {
                textContainer.replaceChild(textEl, input);
            }
        });
    }
    
    saveTaskEdit(id, input, textEl) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;
        
        const newText = input.value.trim();
        if (newText) {
            task.text = newText;
            this.saveAndRender();
            this.showToast('任务已更新');
        } else {
            const taskContainer = input.closest('#task-' + id);
            if (taskContainer) {
                const textContainer = input.parentElement;
                textContainer.replaceChild(textEl, input);
            }
        }
    }

    toggleStatus(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveAndRender();
        }
    }

    clearCompleted() {
        this.tasks = this.tasks.filter(t => !t.completed);
        this.saveAndRender();
        this.showToast('已清理完成项');
    }

    showCategoryForm() {
        document.getElementById('category-form').classList.remove('hidden');
        document.getElementById('category-name').focus();
    }

    hideCategoryForm() {
        document.getElementById('category-form').classList.add('hidden');
        const input = document.getElementById('category-name');
        input.value = '';
        delete input.dataset.editingId;
    }

    // 验证分类名称
    validateCategoryName(name, editingId = null) {
        if (!name) {
            return { valid: false, message: '请输入分类名称' };
        }
        
        if (this.categories.some(cat => cat.name === name && cat.id !== editingId)) {
            return { valid: false, message: '分类名称已存在' };
        }
        
        return { valid: true };
    }
    
    saveCategory() {
        const input = document.getElementById('category-name');
        const name = input.value.trim();
        const editingId = input.dataset.editingId;
        
        const validation = this.validateCategoryName(name, editingId);
        if (!validation.valid) {
            this.showToast(validation.message, 'error');
            input.focus();
            return;
        }
        
        if (editingId) {
            const category = this.categories.find(cat => cat.id === editingId);
            if (category) {
                category.name = name;
                this.saveCategories();
                this.renderCategories();
                this.hideCategoryForm();
                this.showToast('分类已更新');
            }
        } else {
            const category = {
                id: Date.now().toString(),
                name: name
            };
            
            this.categories.push(category);
            this.saveCategories();
            this.renderCategories();
            this.hideCategoryForm();
            this.showToast('分类已添加');
        }
    }

    deleteCategory(id, buttonRect) {
        this.showConfirmDialog(id, buttonRect);
    }
    
    showConfirmDialog(categoryId, buttonRect) {
        const dialog = document.getElementById('confirm-dialog');
        dialog.classList.remove('hidden');
        dialog.dataset.categoryId = categoryId;
        
        // 如果提供了按钮位置信息，调整弹窗位置
        if (buttonRect) {
            // 重置 dialog 的默认样式，移除 flex 布局
            dialog.style.display = 'block';
            dialog.style.position = 'fixed';
            dialog.style.top = '0';
            dialog.style.left = '0';
            dialog.style.right = '0';
            dialog.style.bottom = '0';
            dialog.style.background = 'rgba(0, 0, 0, 0.5)';
            dialog.style.zIndex = '50';
            
            // 创建一个新的弹窗元素，完全覆盖原来的内容
            const newDialogContent = document.createElement('div');
            newDialogContent.className = 'bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl';
            newDialogContent.style.position = 'fixed';
            newDialogContent.style.top = `${buttonRect.bottom + window.scrollY + 10}px`;
            newDialogContent.style.left = `${buttonRect.left + window.scrollX}px`;
            newDialogContent.style.right = 'auto';
            newDialogContent.style.margin = '0';
            newDialogContent.style.maxWidth = '300px';
            newDialogContent.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
            
            // 添加弹窗内容
            newDialogContent.innerHTML = `
                <h3 class="text-lg font-bold mb-2">确认删除</h3>
                <p class="text-gray-600 dark:text-gray-300 mb-4">确定要删除这个分类吗？删除后，该分类下的所有任务也会被删除，不可恢复。</p>
                <div class="flex justify-end gap-2">
                    <button id="confirm-cancel" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">取消</button>
                    <button id="confirm-delete" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">删除</button>
                </div>
            `;
            
            // 清空 dialog 并添加新的弹窗内容
            dialog.innerHTML = '';
            dialog.appendChild(newDialogContent);
            
            // 重新绑定事件处理
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    this.hideConfirmDialog();
                }
            });
            
            // 重新绑定取消按钮事件
            const cancelBtn = dialog.querySelector('#confirm-cancel');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.hideConfirmDialog());
            }
            
            // 重新绑定删除按钮事件
            const deleteBtn = dialog.querySelector('#confirm-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.confirmDeleteCategory());
            }
        }
    }
    
    hideConfirmDialog() {
        const dialog = document.getElementById('confirm-dialog');
        dialog.classList.add('hidden');
        delete dialog.dataset.categoryId;
        
        // 重置 dialog 的样式
        dialog.style.display = '';
        dialog.style.position = '';
        dialog.style.top = '';
        dialog.style.left = '';
        dialog.style.right = '';
        dialog.style.bottom = '';
        dialog.style.background = '';
        dialog.style.zIndex = '';
        
        // 恢复原始的弹窗内容结构
        dialog.innerHTML = `
            <div class="ml-72 md:ml-80 flex-1 max-w-md px-4">
                <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl">
                    <h3 class="text-lg font-bold mb-2">确认删除</h3>
                    <p class="text-gray-600 dark:text-gray-300 mb-4">确定要删除这个分类吗？删除后，该分类下的所有任务也会被删除，不可恢复。</p>
                    <div class="flex justify-end gap-2">
                        <button id="confirm-cancel" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">取消</button>
                        <button id="confirm-delete" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">删除</button>
                    </div>
                </div>
            </div>
        `;
        
        // 重新绑定事件处理程序
        document.getElementById('confirm-cancel').addEventListener('click', () => this.hideConfirmDialog());
        document.getElementById('confirm-delete').addEventListener('click', () => this.confirmDeleteCategory());
        
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                this.hideConfirmDialog();
            }
        });
    }
    
    confirmDeleteCategory() {
        const dialog = document.getElementById('confirm-dialog');
        const categoryId = dialog.dataset.categoryId;
        if (!categoryId) return;
        
        this.categories = this.categories.filter(cat => cat.id !== categoryId);
        this.tasks = this.tasks.filter(task => task.category !== categoryId);
        this.saveCategories();
        this.saveTasks();
        this.renderCategories();
        this.renderTasks();
        this.showToast('分类已删除');
        
        this.hideConfirmDialog();
    }

    editCategory(id) {
        const category = this.categories.find(cat => cat.id === id);
        if (!category) return;
        
        this.showCategoryForm();
        const input = document.getElementById('category-name');
        input.value = category.name;
        input.dataset.editingId = id;
        input.focus();
    }

    renderCategories() {
        const container = document.getElementById('custom-categories');
        if (!container) return;
        
        // 移除旧的事件监听器
        const oldFilterBtns = container.querySelectorAll('.filter-btn');
        oldFilterBtns.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        });
        
        container.innerHTML = this.categories.map(category => `
            <div class="space-y-1">
                <div class="sidebar-item filter-btn group" data-filter="category-${category.id}">
                    <i class="fa fa-folder mr-3"></i>
                    <span class="category-name" data-id="${category.id}">${escapeHtml(category.name)}</span>
                    <input type="text" class="category-edit hidden text-xs px-2 py-1 bg-transparent border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary" data-id="${category.id}" value="${escapeHtml(category.name)}">
                    <div class="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="edit-category text-gray-400 hover:text-primary transition-colors" data-id="${category.id}">
                            <i class="fa fa-pencil"></i>
                        </button>
                        <button class="delete-category text-gray-400 hover:text-red-500 transition-colors" data-id="${category.id}">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="pl-8 space-y-1 subcategories">
                    <div class="sidebar-item filter-btn" data-filter="category-${category.id}-active">
                        <i class="fa fa-clock-o mr-3"></i> 进行中
                    </div>
                    <div class="sidebar-item filter-btn" data-filter="category-${category.id}-completed">
                        <i class="fa fa-check-circle-o mr-3"></i> 已完成
                    </div>
                </div>
            </div>
        `).join('');
        
        // 重新绑定事件监听器
        this.bindCategoryEvents(container);
    }

    bindCategoryEvents(container) {
        // 绑定过滤按钮事件
        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.target.closest('.delete-category') || e.target.closest('.edit-category') || e.target.closest('.category-edit')) return;
                
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                
                document.getElementById('view-title').textContent = btn.innerText.trim();
                this.renderTasks();
                
                if (btn.dataset.filter.startsWith('category-') && !btn.dataset.filter.includes('-active') && !btn.dataset.filter.includes('-completed')) {
                    container.querySelectorAll('.subcategories').forEach(sub => {
                        sub.classList.remove('expanded');
                        // 重置所有子分类的样式
                        sub.style.transform = '';
                        sub.style.transformOrigin = '';
                    });
                    const subcategories = btn.nextElementSibling;
                    if (subcategories && subcategories.classList.contains('subcategories')) {
                        subcategories.classList.add('expanded');
                        
                        // 边界检测：检查子分类是否会超出容器底部
                        this.checkSubcategoryBounds(subcategories, btn);
                    }
                } else if (btn.dataset.filter.includes('-active') || btn.dataset.filter.includes('-completed')) {
                    const parentCategory = btn.closest('.space-y-1').previousElementSibling;
                    if (parentCategory) {
                        container.querySelectorAll('.subcategories').forEach(sub => {
                            sub.classList.remove('expanded');
                            // 重置所有子分类的样式
                            sub.style.transform = '';
                            sub.style.transformOrigin = '';
                        });
                        const subcategories = parentCategory.nextElementSibling;
                        if (subcategories && subcategories.classList.contains('subcategories')) {
                            subcategories.classList.add('expanded');
                            
                            // 边界检测：检查子分类是否会超出容器底部
                            this.checkSubcategoryBounds(subcategories, parentCategory);
                        }
                    }
                } else {
                    container.querySelectorAll('.subcategories').forEach(sub => {
                        sub.classList.remove('expanded');
                        // 重置所有子分类的样式
                        sub.style.transform = '';
                        sub.style.transformOrigin = '';
                    });
                }
            });
        });
        
        // 绑定编辑按钮事件
        container.querySelectorAll('.edit-category').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const sidebarItem = btn.closest('.sidebar-item');
                const span = sidebarItem.querySelector('.category-name');
                const input = sidebarItem.querySelector('.category-edit');
                span.classList.add('hidden');
                input.classList.remove('hidden');
                input.focus();
                input.select();
            });
        });
        
        // 绑定编辑输入框事件
        container.querySelectorAll('.category-edit').forEach(input => {
            input.addEventListener('blur', (e) => {
                this.saveCategoryInline(input);
            });
            
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.saveCategoryInline(input);
                } else if (e.key === 'Escape') {
                    const id = input.dataset.id;
                    const span = input.previousElementSibling;
                    input.classList.add('hidden');
                    span.classList.remove('hidden');
                }
            });
        });
        
        // 绑定删除按钮事件
        container.querySelectorAll('.delete-category').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                // 获取删除按钮的位置信息
                const rect = btn.getBoundingClientRect();
                this.deleteCategory(id, rect);
            });
        });
    }
    
    saveCategoryInline(input) {
        const id = input.dataset.id;
        const newName = input.value.trim();
        const span = input.previousElementSibling;
        
        const validation = this.validateCategoryName(newName, id);
        if (!validation.valid) {
            this.showToast(validation.message, 'error');
            const category = this.categories.find(cat => cat.id === id);
            if (category) {
                input.value = category.name;
            }
            input.classList.add('hidden');
            span.classList.remove('hidden');
            return;
        }
        
        const category = this.categories.find(cat => cat.id === id);
        if (category) {
            category.name = newName;
            this.saveCategories();
            span.textContent = escapeHtml(newName);
            input.classList.add('hidden');
            span.classList.remove('hidden');
            this.showToast('分类已更新');
        }
    }
    
    saveAndRender() {
        this.saveTasks();
        this.renderTasks();
    }

    saveTasks() {
        saveTasks(this.tasks);
    }

    saveCategories() {
        saveCategories(this.categories);
    }

    updateProgress() {
        let filteredTasks = this.tasks;
        
        if (this.currentFilter === 'active') {
            filteredTasks = this.tasks.filter(t => !t.completed);
        } else if (this.currentFilter === 'completed') {
            filteredTasks = this.tasks.filter(t => t.completed);
        } else if (this.currentFilter.startsWith('category-')) {
            const categoryId = this.currentFilter.replace('category-', '').split('-')[0];
            filteredTasks = this.tasks.filter(t => t.category === categoryId);
        }
        
        const total = filteredTasks.length;
        const completed = filteredTasks.filter(t => t.completed).length;
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
        document.getElementById('progress-bar').style.width = `${percent}%`;
        // 显示分数格式的任务进度
        document.getElementById('progress-text').textContent = `${completed}/${total}`;
    }

    renderTasks() {
        const list = document.getElementById('task-list');
        const empty = document.getElementById('empty-state');
        const search = document.getElementById('search-input').value.toLowerCase();

        let filtered = this.tasks.filter(t => {
            const matchesSearch = t.text.toLowerCase().includes(search) || 
                                 t.tags.some(tag => tag.toLowerCase().includes(search));
            
            let matchesFilter = true;
            if (this.currentFilter === 'all') {
                matchesFilter = true;
            } else if (this.currentFilter === 'active') {
                matchesFilter = !t.completed;
            } else if (this.currentFilter === 'completed') {
                matchesFilter = t.completed;
            } else if (this.currentFilter.startsWith('category-')) {
                const filterParts = this.currentFilter.replace('category-', '').split('-');
                const categoryId = filterParts[0];
                const status = filterParts[1];
                
                if (status === 'active') {
                    matchesFilter = t.category === categoryId && !t.completed;
                } else if (status === 'completed') {
                    matchesFilter = t.category === categoryId && t.completed;
                } else {
                    matchesFilter = t.category === categoryId;
                }
            }
            
            return matchesSearch && matchesFilter;
        });

        filtered.sort((a, b) => {
            // 首先按完成状态排序：未完成的在前，已完成的在后
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            
            let result = 0;
            
            if (this.currentSort === 'priority') {
                const p = { high: 1, medium: 2, low: 3 };
                result = p[a.priority] - p[b.priority];
                return this.sortOrder === 'desc' ? result : -result;
            } else if (this.currentSort === 'name') {
                result = a.text.localeCompare(b.text);
                return this.sortOrder === 'desc' ? result : -result;
            } else if (this.currentSort === 'created') {
                result = new Date(a.createdAt) - new Date(b.createdAt);
                return this.sortOrder === 'desc' ? -result : result;
            }
            
            return this.sortOrder === 'desc' ? -result : result;
        });

        if (filtered.length === 0) {
            list.innerHTML = '';
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            
            // 实现滑动排序动画
            const existingTasks = {};
            const existingElements = list.querySelectorAll('[id^="task-"]');
            
            // 记录现有元素
            existingElements.forEach(el => {
                const id = el.id.replace('task-', '');
                existingTasks[id] = el;
                // 清除之前的过渡
                el.style.transition = 'none';
                // 强制重排
                el.offsetHeight;
            });
            
            // 创建新的任务列表
            const fragment = document.createDocumentFragment();
            const taskIds = new Set();
            
            filtered.forEach(task => {
                taskIds.add(task.id);
                
                let taskEl;
                if (existingTasks[task.id]) {
                    // 使用现有元素
                    taskEl = existingTasks[task.id];
                    // 更新内容
                    const newEl = document.createElement('div');
                    newEl.innerHTML = this.createTaskHTML(task);
                    taskEl.innerHTML = newEl.firstElementChild.innerHTML;
                } else {
                    // 创建新元素
                    const newEl = document.createElement('div');
                    newEl.innerHTML = this.createTaskHTML(task);
                    taskEl = newEl.firstElementChild;
                    // 设置初始状态
                    taskEl.style.opacity = '0';
                    taskEl.style.transform = 'translateY(10px)';
                }
                
                fragment.appendChild(taskEl);
            });
            
            // 移除不存在的元素
            existingElements.forEach(el => {
                const id = el.id.replace('task-', '');
                if (!taskIds.has(id)) {
                    el.style.transition = 'all 0.4s ease';
                    el.style.opacity = '0';
                    el.style.transform = 'translateY(10px)';
                    setTimeout(() => el.remove(), 400);
                }
            });
            
            // 保存容器高度以防止布局跳动
            const containerHeight = list.offsetHeight;
            list.style.height = containerHeight + 'px';
            
            // 替换内容
            list.innerHTML = '';
            list.appendChild(fragment);
            
            // 强制重排
            list.offsetHeight;
            
            // 清除固定高度
            list.style.height = '';
            
            // 为所有元素设置过渡并触发动画
            const allElements = list.querySelectorAll('[id^="task-"]');
            allElements.forEach((el, index) => {
                el.style.transition = 'all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                
                // 触发动画
                setTimeout(() => {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                }, index * 30);
            });
        }
        this.updateProgress();
    }
    
    // 分批渲染任务，提高性能
    renderTasksInBatches(tasks, container) {
        container.innerHTML = '';
        const batchSize = 20;
        const totalBatches = Math.ceil(tasks.length / batchSize);
        
        let currentBatch = 0;
        
        function renderNextBatch() {
            if (currentBatch >= totalBatches) return;
            
            const start = currentBatch * batchSize;
            const end = start + batchSize;
            const batchTasks = tasks.slice(start, end);
            
            const fragment = document.createDocumentFragment();
            batchTasks.forEach(task => {
                const taskElement = document.createElement('div');
                taskElement.innerHTML = this.createTaskHTML(task);
                fragment.appendChild(taskElement.firstElementChild);
            });
            
            container.appendChild(fragment);
            currentBatch++;
            
            // 使用 requestAnimationFrame 渲染下一批
            requestAnimationFrame(renderNextBatch.bind(this));
        }
        
        renderNextBatch.bind(this)();
    }
    
    // 检查子分类边界，确保其不会超出容器底部
    checkSubcategoryBounds(subcategories, parentBtn) {
        // 获取父容器
        const container = document.getElementById('custom-categories');
        if (!container) return;
        
        // 等待一小段时间，确保子分类已经完全展开
        setTimeout(() => {
            // 获取父按钮的边界
            const btnBounds = parentBtn.getBoundingClientRect();
            // 获取容器的边界
            const containerBounds = container.getBoundingClientRect();
            
            // 计算父按钮的顶部相对于容器的位置
            const btnTopRelative = btnBounds.top - containerBounds.top;
            
            // 检查父按钮是否接近容器底部
            if (btnTopRelative > containerBounds.height - 100) { // 100px 是一个估计的子分类高度
                // 计算需要向上滚动的距离
                const scrollDistance = btnTopRelative - (containerBounds.height - 150); // 150px 是为子分类预留的空间
                // 计算新的滚动位置
                const newScrollTop = container.scrollTop + scrollDistance;
                
                // 滚动容器，确保子分类完全可见
                container.scrollTo({
                    top: newScrollTop,
                    behavior: 'smooth'
                });
            }
        }, 100); // 等待 100ms 确保动画完成
    }

    createTaskHTML(task) {
        const priorityColors = {
            high: 'text-red-500',
            medium: 'text-amber-500',
            low: 'text-green-500'
        };

        let categoryName = '';
        if (task.category) {
            const category = this.categories.find(cat => cat.id === task.category);
            if (category) {
                categoryName = category.name;
            }
        }
        
        const tags = [];
        if (task.daily) {
            tags.push(`<span class="border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 text-gray-500 dark:text-gray-400"><i class="fa fa-refresh text-[10px] text-green-500"></i>每日</span>`);
        }
        // 检查当前是否在自定义分类视图中，如果不在则显示分类标识
        if (categoryName && !this.currentFilter.startsWith('category-')) {
            tags.push(`<span class="border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 text-gray-500 dark:text-gray-400"><i class="fa fa-folder-o text-[10px] text-blue-500"></i>${escapeHtml(categoryName)}</span>`);
        }
        if (task.dueDate) {
            tags.push(`<span class="border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 text-gray-500 dark:text-gray-400"><i class="fa fa-calendar-o text-[10px]"></i>${task.dueDate}</span>`);
        }
        if (task.tags && task.tags.length > 0) {
            task.tags.forEach(tag => {
                tags.push(`<span class="border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded text-xs font-medium text-gray-500 dark:text-gray-400">#${escapeHtml(tag)}</span>`);
            });
        }
        
        const completedClass = task.completed ? 'opacity-50' : '';
        
        return `
            <div id="task-${task.id}" class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-3 group hover:border-primary/50 dark:hover:border-primary/50 transition-all cursor-pointer ${completedClass}">
                <div class="task-checkbox w-6 h-6 rounded-lg border-2 border-gray-300 flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${task.completed ? 'bg-primary border-primary' : ''}">
                    <i class="fa fa-check text-sm text-white ${task.completed ? '' : 'hidden'}"></i>
                </div>
                <div class="flex-1 min-w-0 flex items-center gap-3">
                    <p class="font-medium text-gray-700 dark:text-gray-200 truncate ${task.completed ? 'line-through text-gray-400' : ''}">${escapeHtml(task.text)}</p>
                    <div class="flex flex-wrap items-center gap-2">
                        ${tags.join('')}
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-[10px] font-bold flex items-center gap-1 ${priorityColors[task.priority]}">
                        <span class="w-1.5 h-1.5 rounded-full ${priorityColors[task.priority].replace('text-', 'bg-')}"></span>
                        ${task.priority.toUpperCase()}
                    </span>
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="edit-task p-2 text-gray-400 hover:text-primary transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                            <i class="fa fa-pencil"></i>
                        </button>
                        <button class="delete-task p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                            <i class="fa fa-trash-o"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    toggleTheme() {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        saveTheme(isDark ? 'dark' : 'light');
        this.showToast(isDark ? '暗色模式已开启' : '亮色模式已开启');
    }

    loadTheme() {
        const theme = getTheme();
        if (theme === 'dark') document.documentElement.classList.add('dark');
    }
    
    updateSortButtons() {
        document.querySelectorAll('.sort-btn').forEach(btn => {
            const sortType = btn.dataset.sort;
            if (this.currentSort === sortType) {
                btn.classList.add('text-primary');
                btn.classList.remove('text-gray-500');
                const orderEl = btn.querySelector('.sort-order');
                if (orderEl) {
                    orderEl.textContent = this.sortOrder === 'desc' ? '↓' : '↑';
                }
            } else {
                btn.classList.remove('text-primary');
                btn.classList.add('text-gray-500');
                const orderEl = btn.querySelector('.sort-order');
                if (orderEl) {
                    orderEl.textContent = '↓';
                }
            }
        });
    }

    exportTasks() {
        const dataStr = JSON.stringify(this.tasks, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `todo-backup.json`;
        link.click();
        URL.revokeObjectURL(url);
        this.showToast('导出成功');
    }

    importTasks(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // 验证文件类型
        if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
            this.showToast('请选择 JSON 格式的文件', 'error');
            event.target.value = '';
            return;
        }
        
        // 验证文件大小
        if (file.size > 1024 * 1024) { // 1MB 限制
            this.showToast('文件大小不能超过 1MB', 'error');
            event.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (!Array.isArray(imported)) {
                    this.showToast('导入失败，文件格式错误：不是有效的任务数组', 'error');
                    return;
                }
                
                // 验证导入的数据结构
                const valid = imported.every(task => {
                    return typeof task === 'object' && 
                           task !== null && 
                           typeof task.id === 'string' && 
                           typeof task.text === 'string';
                });
                
                if (!valid) {
                    this.showToast('导入失败，文件格式错误：任务数据结构不正确', 'error');
                    return;
                }
                
                if (confirm('确定要导入这些任务吗？这将会覆盖当前的任务列表！')) {
                    this.tasks = imported;
                    this.saveAndRender();
                    this.showToast(`导入成功，共导入 ${imported.length} 个任务`, 'success');
                }
            } catch (err) {
                if (err instanceof SyntaxError) {
                    this.showToast('导入失败，JSON 格式错误', 'error');
                } else {
                    this.showToast('导入失败，未知错误', 'error');
                }
            }
        };
        
        reader.onerror = () => {
            this.showToast('读取文件失败', 'error');
        };
        
        reader.readAsText(file);
        event.target.value = '';
    }

    // 备份功能
    showBackupDialog() {
        const backupDialog = document.getElementById('backup-dialog');
        if (!backupDialog) return;
        
        backupDialog.classList.remove('hidden');
        this.loadBackupConfig();
    }

    hideBackupDialog() {
        const backupDialog = document.getElementById('backup-dialog');
        if (backupDialog) {
            backupDialog.classList.add('hidden');
        }
    }
    
    // 生成格式化的时间戳
    generateTimestamp() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    }
    
    // 准备备份数据
    prepareBackupData() {
        return {
            tasks: this.tasks,
            categories: this.categories,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
    }

    loadBackupConfig() {
        const config = getBackupConfig();
        
        document.getElementById('github-token').value = config.githubToken || '';
        document.getElementById('github-repo').value = config.githubRepo || '';
        document.getElementById('github-file-path').value = config.githubFilePath || 'backup/todo.json';
        document.getElementById('webdav-url').value = config.webdavUrl || '';
        document.getElementById('webdav-username').value = config.webdavUsername || '';
        document.getElementById('webdav-password').value = config.webdavPassword || '';
        document.getElementById('webdav-file-path').value = config.webdavFilePath || 'backup/todo.json';
        document.getElementById('backup-incremental').checked = config.incremental || false;
        document.getElementById('backup-timestamp').checked = config.timestamp !== false;
        
        // 检查 GitHub 授权状态
        const githubToken = config.githubToken || getGitHubToken();
        const authStatus = document.getElementById('github-auth-status');
        if (githubToken) {
            authStatus.textContent = '已验证';
            authStatus.className = 'text-xs text-green-500 dark:text-green-400';
            document.getElementById('github-auth').textContent = '重新验证';
            
            // 获取用户信息并显示用户名
            fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            })
            .then(response => response.json())
            .then(user => {
                const usernameElement = document.getElementById('github-username');
                usernameElement.querySelector('span').textContent = user.login;
                usernameElement.classList.remove('hidden');
            })
            .catch(error => {
                console.error('获取用户信息错误:', error);
            });
            
            // 自动加载仓库列表
            this.loadGitHubRepos(githubToken, config.githubRepo);
        } else {
            authStatus.textContent = '未验证';
            authStatus.className = 'text-xs text-gray-500 dark:text-gray-400';
            document.getElementById('github-auth').innerHTML = '<i class="fa fa-check"></i> 验证 Token';
            
            // 隐藏用户名
            const usernameElement = document.getElementById('github-username');
            usernameElement.classList.add('hidden');
        }
        authStatus.classList.remove('hidden');
    }

    saveBackupConfig() {
        const config = {
            githubToken: document.getElementById('github-token').value,
            githubRepo: document.getElementById('github-repo').value,
            githubFilePath: document.getElementById('github-file-path').value,
            webdavUrl: document.getElementById('webdav-url').value,
            webdavUsername: document.getElementById('webdav-username').value,
            webdavPassword: document.getElementById('webdav-password').value,
            webdavFilePath: document.getElementById('webdav-file-path').value,
            incremental: document.getElementById('backup-incremental').checked,
            timestamp: document.getElementById('backup-timestamp').checked
        };
        saveBackupConfig(config);
    }

    authorizeGitHub() {
        // 验证 GitHub Personal Access Token
        const token = document.getElementById('github-token').value.trim();
        
        if (!token) {
            this.showToast('请输入GitHub Personal Access Token', 'error');
            return;
        }
        
        // 验证中
        
        // 验证Token有效性并获取用户信息和仓库列表
        Promise.all([
            fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }),
            fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            })
        ])
        .then(([userResponse, reposResponse]) => {
            if (!userResponse.ok || !reposResponse.ok) {
                throw new Error('Token验证失败');
            }
            return Promise.all([userResponse.json(), reposResponse.json()]);
        })
        .then(([user, repos]) => {
            // Token有效，获取到用户信息和仓库列表
            this.showToast('GitHub Token验证成功', 'success');
            saveGitHubToken(token);
            
            // 显示用户名
            const usernameElement = document.getElementById('github-username');
            usernameElement.querySelector('span').textContent = user.login;
            usernameElement.classList.remove('hidden');
            
            // 填充仓库数据列表
            const repoDatalist = document.getElementById('github-repo-list');
            repoDatalist.innerHTML = '';
            
            repos.forEach(repo => {
                const option = document.createElement('option');
                option.value = `${repo.owner.login}/${repo.name}`;
                option.textContent = repo.name;
                repoDatalist.appendChild(option);
            });
            
            // 恢复之前选择的仓库
            const config = getBackupConfig();
            if (config.githubRepo) {
                document.getElementById('github-repo').value = config.githubRepo;
            }
        })
        .catch(error => {
            this.showToast(`验证错误: ${error.message}`, 'error');
            console.error('Token验证详细错误:', error);
        });
    }

    loadGitHubRepos(token, selectedRepo) {
        fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('获取仓库列表失败');
            }
        })
        .then(repos => {
            // 填充仓库数据列表
            const repoDatalist = document.getElementById('github-repo-list');
            repoDatalist.innerHTML = '';
            
            repos.forEach(repo => {
                const option = document.createElement('option');
                option.value = `${repo.owner.login}/${repo.name}`;
                option.textContent = repo.name;
                repoDatalist.appendChild(option);
            });
            
            // 恢复之前选择的仓库
            if (selectedRepo) {
                document.getElementById('github-repo').value = selectedRepo;
            }
        })
        .catch(error => {
            console.error('加载仓库列表错误:', error);
        });
    }

    performBackup() {
        this.saveBackupConfig();
        // 执行 GitHub 备份
        this.backupToGitHub();
        
        // 执行 WebDAV 备份
        this.backupToWebDAV();
    }

    backupToGitHub() {
        const config = getBackupConfig();
        const githubToken = config.githubToken || getGitHubToken();
        
        if (!githubToken) {
            this.showToast('GitHub Token未设置，请先验证Token', 'error');
            return;
        }
        
        if (!config.githubRepo) {
            this.showToast('请设置 GitHub 仓库', 'error');
            return;
        }
        
        // 准备备份数据
        const backupData = this.prepareBackupData();
        
        // 序列化数据
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(backupData, null, 2))));
        
        // 构建文件路径
        let filePath = config.githubFilePath || 'backup/todo.json';
        if (config.timestamp) {
            const timestamp = this.generateTimestamp();
            filePath = filePath.replace('.json', `_${timestamp}.json`);
        }
        
        // 解析仓库信息
        const repoParts = config.githubRepo.split('/');
        if (repoParts.length !== 2) {
            this.showToast('GitHub 仓库格式错误，请使用 "用户名/仓库名" 格式', 'error');
            return;
        }
        const owner = repoParts[0];
        const repo = repoParts[1];
        
        // 检查文件是否存在
        fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        })
        .then(response => {
            if (response.status === 404) {
                // 文件不存在，创建新文件
                return this.createGitHubFile(owner, repo, filePath, content, githubToken);
            } else if (response.ok) {
                // 文件存在，更新文件
                return response.json().then(data => {
                    return this.updateGitHubFile(owner, repo, filePath, content, data.sha, githubToken);
                });
            } else {
                throw new Error(`GitHub API 错误: ${response.status}`);
            }
        })
        .then(data => {
            this.showToast('GitHub 备份成功', 'success');
        })
        .catch(error => {
            // 优化：提供更详细的错误信息
            let errorMessage = 'GitHub 备份失败';
            if (error.message) {
                errorMessage += `: ${error.message}`;
            }
            if (error.status) {
                errorMessage += ` (状态码: ${error.status})`;
            }
            this.showToast(errorMessage, 'error');
            console.error('GitHub 备份详细错误:', error);
        });
    }

    createGitHubFile(owner, repo, path, content, token) {
        return fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: 'Backup todo tasks',
                content: content
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`创建文件失败: ${response.status}`);
            }
            return response.json();
        });
    }

    updateGitHubFile(owner, repo, path, content, sha, token) {
        return fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: 'Update backup',
                content: content,
                sha: sha
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`更新文件失败: ${response.status}`);
            }
            return response.json();
        });
    }

    backupToWebDAV() {
        const config = getBackupConfig();
        
        if (!config.webdavUrl) {
            // WebDAV 未配置，跳过
            return;
        }
        
        // 准备备份数据
        const backupData = this.prepareBackupData();
        
        // 序列化数据
        const content = JSON.stringify(backupData, null, 2);
        
        // 构建文件路径
        let filePath = config.webdavFilePath || 'backup/todo.json';
        if (config.timestamp) {
            const timestamp = this.generateTimestamp();
            filePath = filePath.replace('.json', `_${timestamp}.json`);
        }
        
        // 构建完整 URL
        let url = config.webdavUrl;
        if (!url.endsWith('/')) {
            url += '/';
        }
        url += filePath;
        
        // 创建请求
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        // 添加认证
        if (config.webdavUsername && config.webdavPassword) {
            const auth = btoa(`${config.webdavUsername}:${config.webdavPassword}`);
            xhr.setRequestHeader('Authorization', `Basic ${auth}`);
        }
        
        // 处理响应
        xhr.onload = () => {
            if (xhr.status === 201 || xhr.status === 204) {
                this.showToast('WebDAV 备份成功', 'success');
            } else {
                // 优化：提供更详细的错误信息
                let errorMessage = `WebDAV 备份错误: ${xhr.status} ${xhr.statusText}`;
                if (xhr.status === 401) {
                    errorMessage = 'WebDAV 认证失败，请检查用户名和密码';
                } else if (xhr.status === 403) {
                    errorMessage = 'WebDAV 权限不足';
                } else if (xhr.status === 404) {
                    errorMessage = 'WebDAV 路径不存在';
                } else if (xhr.status === 500) {
                    errorMessage = 'WebDAV 服务器错误';
                }
                this.showToast(errorMessage, 'error');
                console.error('WebDAV 备份错误:', xhr.status, xhr.statusText);
            }
        };
        
        // 处理错误
        xhr.onerror = () => {
            // 优化：提供更详细的错误信息
            this.showToast('WebDAV 连接错误，请检查服务器地址和网络连接', 'error');
            console.error('WebDAV 连接错误');
        };
        
        // 发送请求
        xhr.send(content);
    }
}

// 初始化应用
new TodoApp();
