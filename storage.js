// 本地存储操作

const STORAGE_KEYS = {
    TASKS: 'todo-tasks',
    CATEGORIES: 'todo-categories',
    THEME: 'todo-theme',
    LAST_RESET: 'todo-last-reset',
    BACKUP_CONFIG: 'backupConfig',
    GITHUB_TOKEN: 'githubToken'
};

// 检查本地存储可用性
function isLocalStorageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

// 安全的localStorage操作
function safeLocalStorageOperation(operation, key, value = null) {
    if (!isLocalStorageAvailable()) {
        console.warn('LocalStorage is not available');
        return null;
    }
    
    try {
        if (operation === 'get') {
            return localStorage.getItem(key);
        } else if (operation === 'set') {
            localStorage.setItem(key, value);
            return true;
        } else if (operation === 'remove') {
            localStorage.removeItem(key);
            return true;
        }
    } catch (error) {
        console.error(`LocalStorage operation failed: ${error.message}`);
        return null;
    }
}

// 获取任务
export function getTasks() {
    try {
        const tasks = safeLocalStorageOperation('get', STORAGE_KEYS.TASKS);
        if (tasks) {
            const parsedTasks = JSON.parse(tasks);
            return Array.isArray(parsedTasks) ? parsedTasks : [];
        }
    } catch (error) {
        console.error('Failed to parse tasks:', error);
    }
    return [];
}

// 保存任务
export function saveTasks(tasks) {
    try {
        if (Array.isArray(tasks)) {
            const serialized = JSON.stringify(tasks);
            return safeLocalStorageOperation('set', STORAGE_KEYS.TASKS, serialized);
        }
    } catch (error) {
        console.error('Failed to save tasks:', error);
    }
    return false;
}

// 获取分类
export function getCategories() {
    try {
        const categories = safeLocalStorageOperation('get', STORAGE_KEYS.CATEGORIES);
        if (categories) {
            const parsedCategories = JSON.parse(categories);
            return Array.isArray(parsedCategories) ? parsedCategories : [];
        }
    } catch (error) {
        console.error('Failed to parse categories:', error);
    }
    return [];
}

// 保存分类
export function saveCategories(categories) {
    try {
        if (Array.isArray(categories)) {
            const serialized = JSON.stringify(categories);
            return safeLocalStorageOperation('set', STORAGE_KEYS.CATEGORIES, serialized);
        }
    } catch (error) {
        console.error('Failed to save categories:', error);
    }
    return false;
}

// 获取主题
export function getTheme() {
    return safeLocalStorageOperation('get', STORAGE_KEYS.THEME);
}

// 保存主题
export function saveTheme(theme) {
    return safeLocalStorageOperation('set', STORAGE_KEYS.THEME, theme);
}

// 获取最后重置日期
export function getLastResetDate() {
    const date = safeLocalStorageOperation('get', STORAGE_KEYS.LAST_RESET);
    return date || new Date().toDateString();
}

// 保存最后重置日期
export function saveLastResetDate(date) {
    return safeLocalStorageOperation('set', STORAGE_KEYS.LAST_RESET, date);
}

// 获取备份配置
export function getBackupConfig() {
    try {
        const config = safeLocalStorageOperation('get', STORAGE_KEYS.BACKUP_CONFIG);
        if (config) {
            return JSON.parse(config);
        }
    } catch (error) {
        console.error('Failed to parse backup config:', error);
    }
    return {};
}

// 保存备份配置
export function saveBackupConfig(config) {
    try {
        if (typeof config === 'object' && config !== null) {
            const serialized = JSON.stringify(config);
            return safeLocalStorageOperation('set', STORAGE_KEYS.BACKUP_CONFIG, serialized);
        }
    } catch (error) {
        console.error('Failed to save backup config:', error);
    }
    return false;
}

// 获取GitHub Token
export function getGitHubToken() {
    return safeLocalStorageOperation('get', STORAGE_KEYS.GITHUB_TOKEN);
}

// 保存GitHub Token
export function saveGitHubToken(token) {
    return safeLocalStorageOperation('set', STORAGE_KEYS.GITHUB_TOKEN, token);
}

// 清除所有数据
export function clearAllData() {
    try {
        Object.values(STORAGE_KEYS).forEach(key => {
            safeLocalStorageOperation('remove', key);
        });
        return true;
    } catch (error) {
        console.error('Failed to clear data:', error);
        return false;
    }
}
