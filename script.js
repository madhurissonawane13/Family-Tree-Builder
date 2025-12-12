// Family Tree Builder - Working Version

const CONFIG = {
    STORE_KEY: 'family-tree-builder-data',
    APP_VERSION: '2.1.0'
};

// Application State
const AppState = {
    members: [],
    selectedMemberId: null,
    currentView: 'tree',
    treeZoom: 1,
    theme: 'light',
    collapsedNodes: new Set()
};

// DOM Elements
const Elements = {
    // Form
    memberForm: document.getElementById('memberForm'),
    memberId: document.getElementById('memberId'),
    nameInput: document.getElementById('name'),
    genderOptions: document.querySelectorAll('input[name="gender"]'),
    dobInput: document.getElementById('dob'),
    fatherSelect: document.getElementById('fatherSelect'),
    motherSelect: document.getElementById('motherSelect'),
    spouseSelect: document.getElementById('spouseSelect'),
    childrenSelect: document.getElementById('childrenSelect'),
    photoInput: document.getElementById('photo'),
    photoPreview: document.getElementById('photoPreview'),
    photoUploadArea: document.getElementById('photoUploadArea'),
    removePhotoBtn: document.getElementById('removePhoto'),
    
    // Buttons
    saveBtn: document.getElementById('saveBtn'),
    resetBtn: document.getElementById('resetBtn'),
    deleteBtn: document.getElementById('deleteBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importFile: document.getElementById('importFile'),
    clearBtn: document.getElementById('clearBtn'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    exportDataBtn: document.getElementById('exportDataBtn'),
    
    // Tree Controls
    expandAllBtn: document.getElementById('expandAll'),
    collapseAllBtn: document.getElementById('collapseAll'),
    zoomInBtn: document.getElementById('zoomIn'),
    zoomOutBtn: document.getElementById('zoomOut'),
    centerTreeBtn: document.getElementById('centerTree'),
    
    // Views
    treeCanvas: document.getElementById('treeCanvas'),
    membersGrid: document.getElementById('membersGrid'),
    infoPanel: document.getElementById('infoPanel'),
    closeInfoPanel: document.getElementById('closeInfoPanel'),
    emptyState: document.getElementById('emptyState'),
    addFirstMemberBtn: document.getElementById('addFirstMember'),
    
    // Stats
    totalMembers: document.getElementById('totalMembers'),
    maleCount: document.getElementById('maleCount'),
    femaleCount: document.getElementById('femaleCount'),
    
    // Theme
    themeToggle: document.getElementById('themeToggle'),
    
    // Templates
    nodeTemplate: document.getElementById('nodeTemplate'),
    memberCardTemplate: document.getElementById('memberCardTemplate'),
    toastTemplate: document.getElementById('toastTemplate')
};

// Initialize Application
function init() {
    loadData();
    setupEventListeners();
    render();
    setupTabs();
    setupPhotoUpload();
    
    // Add sample data if empty
    if (AppState.members.length === 0) {
        setTimeout(addSampleData, 500);
    }
}

// Data Management
function loadData() {
    try {
        const data = localStorage.getItem(CONFIG.STORE_KEY);
        if (data) {
            const parsed = JSON.parse(data);
            AppState.members = parsed.members || [];
            AppState.collapsedNodes = new Set(parsed.collapsedNodes || []);
            AppState.theme = parsed.theme || 'light';
            updateStatistics();
            showToast('Data loaded successfully', 'success');
        }
    } catch (error) {
        console.error('Failed to load data:', error);
        showToast('Failed to load saved data', 'error');
    }
}

function saveData() {
    try {
        const data = {
            members: AppState.members,
            collapsedNodes: Array.from(AppState.collapsedNodes),
            theme: AppState.theme,
            version: CONFIG.APP_VERSION,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(CONFIG.STORE_KEY, JSON.stringify(data));
        updateStatistics();
    } catch (error) {
        console.error('Failed to save data:', error);
        showToast('Failed to save data', 'error');
    }
}

// Member Management
function createMember(memberData) {
    const id = 'member_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const member = {
        id,
        name: memberData.name.trim(),
        gender: memberData.gender || 'other',
        dob: memberData.dob || '',
        birthPlace: memberData.birthPlace || '',
        occupation: memberData.occupation || '',
        email: memberData.email || '',
        bio: memberData.bio || '',
        photo: memberData.photo || '',
        spouse: memberData.spouse || null,
        father: memberData.father || null,
        mother: memberData.mother || null,
        children: memberData.children || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    AppState.members.push(member);
    saveData();
    render();
    showToast(`${member.name} added to family tree`, 'success');
    return member;
}

function updateMember(id, memberData) {
    const index = AppState.members.findIndex(m => m.id === id);
    if (index === -1) {
        showToast('Member not found', 'error');
        return null;
    }
    
    const updatedMember = {
        ...AppState.members[index],
        ...memberData,
        updatedAt: new Date().toISOString()
    };
    
    AppState.members[index] = updatedMember;
    saveData();
    render();
    showToast(`${updatedMember.name} updated successfully`, 'success');
    return updatedMember;
}

function deleteMember(id) {
    const member = AppState.members.find(m => m.id === id);
    if (!member) return;
    
    if (!confirm(`Are you sure you want to delete ${member.name}? This will also remove all relationship links.`)) {
        return;
    }
    
    // Remove from children lists
    AppState.members.forEach(m => {
        m.children = m.children.filter(childId => childId !== id);
        if (m.spouse === id) m.spouse = null;
        if (m.father === id) m.father = null;
        if (m.mother === id) m.mother = null;
    });
    
    AppState.members = AppState.members.filter(m => m.id !== id);
    AppState.selectedMemberId = null;
    saveData();
    render();
    showToast(`${member.name} removed from family tree`, 'warning');
}

// Rendering
function render() {
    renderTree();
    renderMembersList();
    updateSelectOptions();
    updateEmptyState();
    updateStatistics();
}

function renderTree() {
    if (!Elements.treeCanvas) return;
    
    Elements.treeCanvas.innerHTML = '';
    
    if (AppState.members.length === 0) {
        Elements.emptyState.style.display = 'flex';
        return;
    }
    
    Elements.emptyState.style.display = 'none';
    
    // Create root container
    const container = document.createElement('div');
    container.className = 'tree-root';
    
    // Find root members (no parents)
    const rootMembers = AppState.members.filter(member => 
        !member.father && !member.mother
    );
    
    if (rootMembers.length === 0) {
        // If no root members, show all as root
        AppState.members.forEach(member => {
            container.appendChild(createTreeNode(member));
        });
    } else {
        // Build hierarchical tree
        rootMembers.forEach(member => {
            container.appendChild(buildTreeHierarchy(member));
        });
    }
    
    Elements.treeCanvas.appendChild(container);
    
    // Apply zoom
    Elements.treeCanvas.style.transform = `scale(${AppState.treeZoom})`;
    Elements.treeCanvas.style.transformOrigin = 'center center';
}

function buildTreeHierarchy(member, level = 0) {
    const wrapper = document.createElement('div');
    wrapper.className = `tree-level level-${level}`;
    
    const node = createTreeNode(member);
    wrapper.appendChild(node);
    
    // Add children if not collapsed
    if (member.children && member.children.length > 0 && !AppState.collapsedNodes.has(member.id)) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'children-container';
        
        member.children.forEach(childId => {
            const child = AppState.members.find(m => m.id === childId);
            if (child) {
                childrenContainer.appendChild(buildTreeHierarchy(child, level + 1));
            }
        });
        
        wrapper.appendChild(childrenContainer);
    }
    
    return wrapper;
}

function createTreeNode(member) {
    const template = Elements.nodeTemplate.content.cloneNode(true);
    const node = template.querySelector('.node');
    node.dataset.id = member.id;
    node.dataset.gender = member.gender;
    
    if (AppState.selectedMemberId === member.id) {
        node.classList.add('selected');
    }
    
    // Avatar
    const avatarPlaceholder = node.querySelector('.avatar-placeholder');
    if (member.photo) {
        const avatarImg = node.querySelector('.avatar');
        avatarImg.src = member.photo;
        avatarImg.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
    } else {
        avatarPlaceholder.style.display = 'flex';
        avatarPlaceholder.style.backgroundColor = getGenderColor(member.gender);
        
        // Add initials
        const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        avatarPlaceholder.textContent = initials;
        avatarPlaceholder.innerHTML = '';
        avatarPlaceholder.textContent = initials;
    }
    
    // Name
    node.querySelector('.node-name').textContent = member.name;
    
    // Gender
    const genderSpan = node.querySelector('.node-gender');
    genderSpan.textContent = member.gender.charAt(0).toUpperCase() + member.gender.slice(1);
    genderSpan.className = `gender-badge gender-${member.gender}`;
    
    // Age
    const ageSpan = node.querySelector('.node-age');
    if (member.dob) {
        const age = calculateAge(member.dob);
        ageSpan.textContent = `${age} years`;
    } else {
        ageSpan.textContent = 'Age unknown';
    }
    
    // Children count
    const childrenCount = member.children ? member.children.length : 0;
    node.querySelector('.children-count').textContent = childrenCount;
    
    // Event listeners
    const viewBtn = node.querySelector('.view');
    const editBtn = node.querySelector('.edit');
    const expandBtn = node.querySelector('.expand');
    
    viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showMemberDetails(member.id);
    });
    
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        populateForm(member.id);
    });
    
    expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNodeExpand(member.id);
    });
    
    // Node click
    node.addEventListener('click', (e) => {
        if (!e.target.closest('.node-action')) {
            selectNode(member.id);
        }
    });
    
    // Update expand button
    if (member.children && member.children.length > 0) {
        expandBtn.style.display = 'flex';
        if (AppState.collapsedNodes.has(member.id)) {
            expandBtn.querySelector('i').className = 'fas fa-chevron-right';
        } else {
            expandBtn.querySelector('i').className = 'fas fa-chevron-down';
        }
    } else {
        expandBtn.style.display = 'none';
    }
    
    return node;
}

function renderMembersList() {
    if (!Elements.membersGrid) return;
    
    Elements.membersGrid.innerHTML = '';
    
    if (AppState.members.length === 0) {
        Elements.membersGrid.innerHTML = `
            <div class="empty-list">
                <i class="fas fa-users"></i>
                <h4>No Family Members</h4>
                <p>Add your first family member to get started</p>
            </div>
        `;
        return;
    }
    
    // Apply search filter
    let filteredMembers = AppState.members;
    const searchQuery = Elements.searchInput?.value?.trim().toLowerCase();
    if (searchQuery) {
        filteredMembers = AppState.members.filter(member => 
            member.name.toLowerCase().includes(searchQuery) ||
            (member.occupation && member.occupation.toLowerCase().includes(searchQuery))
        );
    }
    
    // Sort
    const sortBy = document.getElementById('sortBy')?.value || 'name';
    filteredMembers.sort((a, b) => {
        switch (sortBy) {
            case 'dob': return (a.dob || '').localeCompare(b.dob || '');
            case 'gender': return a.gender.localeCompare(b.gender);
            default: return a.name.localeCompare(b.name);
        }
    });
    
    // Render cards
    filteredMembers.forEach(member => {
        const card = createMemberCard(member);
        Elements.membersGrid.appendChild(card);
    });
}

function createMemberCard(member) {
    const template = Elements.memberCardTemplate.content.cloneNode(true);
    const card = template.querySelector('.member-card');
    card.dataset.id = member.id;
    
    // Avatar
    const avatarPlaceholder = card.querySelector('.avatar-placeholder');
    if (member.photo) {
        const avatarImg = card.querySelector('.avatar');
        avatarImg.src = member.photo;
        avatarImg.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
    } else {
        avatarPlaceholder.style.display = 'flex';
        avatarPlaceholder.style.backgroundColor = getGenderColor(member.gender);
        
        const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        avatarPlaceholder.textContent = initials;
    }
    
    // Name
    card.querySelector('.card-name').textContent = member.name;
    
    // Gender
    const genderSpan = card.querySelector('.card-gender');
    genderSpan.textContent = member.gender.charAt(0).toUpperCase() + member.gender.slice(1);
    genderSpan.className = `gender-badge gender-${member.gender}`;
    
    // Date of Birth
    const dobSpan = card.querySelector('.card-dob');
    if (member.dob) {
        dobSpan.textContent = new Date(member.dob).toLocaleDateString();
    } else {
        dobSpan.textContent = 'Date unknown';
    }
    
    // Relations
    const parentsCount = [member.father, member.mother].filter(Boolean).length;
    card.querySelector('.parents-count').textContent = `Parents: ${parentsCount}`;
    
    card.querySelector('.spouse-status').textContent = member.spouse ? 'Has spouse' : 'No spouse';
    
    const childrenCount = member.children ? member.children.length : 0;
    card.querySelector('.children-count').textContent = `Children: ${childrenCount}`;
    
    // Event listeners
    const viewBtn = card.querySelector('.view');
    const editBtn = card.querySelector('.edit');
    const viewTreeBtn = card.querySelector('.view-tree');
    
    viewBtn.addEventListener('click', () => showMemberDetails(member.id));
    editBtn.addEventListener('click', () => populateForm(member.id));
    viewTreeBtn.addEventListener('click', () => {
        switchView('tree');
        selectNode(member.id);
        setTimeout(() => centerOnNode(member.id), 100);
    });
    
    return card;
}

// Form Handling
function populateForm(id) {
    const member = AppState.members.find(m => m.id === id);
    if (!member) return;
    
    AppState.selectedMemberId = id;
    
    Elements.memberId.value = member.id;
    Elements.nameInput.value = member.name;
    
    // Set gender
    Elements.genderOptions.forEach(radio => {
        radio.checked = radio.value === member.gender;
    });
    
    Elements.dobInput.value = member.dob;
    document.getElementById('birthPlace').value = member.birthPlace || '';
    document.getElementById('email').value = member.email || '';
    document.getElementById('occupation').value = member.occupation || '';
    document.getElementById('bio').value = member.bio || '';
    
    // Set relations
    Elements.fatherSelect.value = member.father || '';
    Elements.motherSelect.value = member.mother || '';
    Elements.spouseSelect.value = member.spouse || '';
    
    // Set children
    if (Elements.childrenSelect) {
        Array.from(Elements.childrenSelect.options).forEach(option => {
            option.selected = member.children.includes(option.value);
        });
        updateSelectedChildrenDisplay();
    }
    
    // Set photo
    if (member.photo) {
        Elements.photoPreview.src = member.photo;
        Elements.photoPreviewContainer.classList.add('show');
        Elements.photoUploadArea.style.display = 'none';
    } else {
        Elements.photoPreviewContainer.classList.remove('show');
        Elements.photoUploadArea.style.display = 'flex';
    }
    
    Elements.deleteBtn.style.display = 'flex';
    switchFormTab('basic');
    showToast(`Editing ${member.name}`, 'info');
}

function resetForm() {
    if (Elements.memberForm) {
        Elements.memberForm.reset();
    }
    Elements.memberId.value = '';
    Elements.photoPreview.src = '';
    Elements.photoPreviewContainer.classList.remove('show');
    Elements.photoUploadArea.style.display = 'flex';
    Elements.deleteBtn.style.display = 'none';
    AppState.selectedMemberId = null;
    document.getElementById('selectedChildren').innerHTML = '<div class="no-selection">No children selected</div>';
    switchFormTab('basic');
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    const id = Elements.memberId.value;
    const name = Elements.nameInput.value.trim();
    
    if (!name) {
        showToast('Please enter a name', 'error');
        Elements.nameInput.focus();
        return;
    }
    
    const gender = document.querySelector('input[name="gender"]:checked')?.value || 'other';
    const dob = Elements.dobInput.value;
    const birthPlace = document.getElementById('birthPlace').value || '';
    const email = document.getElementById('email').value || '';
    const occupation = document.getElementById('occupation').value || '';
    const bio = document.getElementById('bio').value || '';
    const father = Elements.fatherSelect.value || null;
    const mother = Elements.motherSelect.value || null;
    const spouse = Elements.spouseSelect.value || null;
    
    // Get children
    let children = [];
    if (Elements.childrenSelect) {
        children = Array.from(Elements.childrenSelect.selectedOptions)
            .map(option => option.value)
            .filter(value => value);
    }
    
    const photo = Elements.photoPreview.src.startsWith('data:image') ? Elements.photoPreview.src : '';
    
    const memberData = {
        name,
        gender,
        dob,
        birthPlace,
        email,
        occupation,
        bio,
        photo,
        father,
        mother,
        spouse,
        children
    };
    
    if (id) {
        updateMember(id, memberData);
    } else {
        createMember(memberData);
    }
    
    resetForm();
}

// Event Listeners
function setupEventListeners() {
    // Form
    if (Elements.memberForm) {
        Elements.memberForm.addEventListener('submit', handleFormSubmit);
    }
    
    if (Elements.resetBtn) {
        Elements.resetBtn.addEventListener('click', resetForm);
    }
    
    if (Elements.deleteBtn) {
        Elements.deleteBtn.addEventListener('click', () => {
            const id = Elements.memberId.value;
            if (id) {
                deleteMember(id);
                resetForm();
            }
        });
    }
    
    // Search
    if (Elements.searchBtn && Elements.searchInput) {
        Elements.searchBtn.addEventListener('click', () => {
            AppState.currentView = 'list';
            switchView('list');
            renderMembersList();
        });
        
        Elements.searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                AppState.currentView = 'list';
                switchView('list');
                renderMembersList();
            }
        });
    }
    
    // Tree controls
    if (Elements.expandAllBtn) {
        Elements.expandAllBtn.addEventListener('click', () => {
            AppState.collapsedNodes.clear();
            renderTree();
        });
    }
    
    if (Elements.collapseAllBtn) {
        Elements.collapseAllBtn.addEventListener('click', () => {
            AppState.members.forEach(member => {
                AppState.collapsedNodes.add(member.id);
            });
            renderTree();
        });
    }
    
    if (Elements.zoomInBtn) {
        Elements.zoomInBtn.addEventListener('click', () => {
            AppState.treeZoom = Math.min(3, AppState.treeZoom + 0.2);
            renderTree();
        });
    }
    
    if (Elements.zoomOutBtn) {
        Elements.zoomOutBtn.addEventListener('click', () => {
            AppState.treeZoom = Math.max(0.5, AppState.treeZoom - 0.2);
            renderTree();
        });
    }
    
    if (Elements.centerTreeBtn) {
        Elements.centerTreeBtn.addEventListener('click', () => {
            if (Elements.treeCanvas) {
                Elements.treeCanvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }
    
    // Data actions
    if (Elements.exportBtn) {
        Elements.exportBtn.addEventListener('click', exportData);
    }
    
    if (Elements.exportDataBtn) {
        Elements.exportDataBtn.addEventListener('click', exportData);
    }
    
    if (Elements.importFile) {
        Elements.importFile.addEventListener('change', importData);
    }
    
    if (Elements.clearBtn) {
        Elements.clearBtn.addEventListener('click', clearAllData);
    }
    
    // Theme toggle
    if (Elements.themeToggle) {
        Elements.themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Info panel
    if (Elements.closeInfoPanel) {
        Elements.closeInfoPanel.addEventListener('click', () => {
            Elements.infoPanel.classList.remove('active');
        });
    }
    
    // Add first member
    if (Elements.addFirstMemberBtn) {
        Elements.addFirstMemberBtn.addEventListener('click', () => {
            resetForm();
            Elements.nameInput.focus();
        });
    }
    
    // View switching
    document.querySelectorAll('.view-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.currentTarget.dataset.view;
            switchView(view);
        });
    });
    
    // Sort control
    const sortSelect = document.getElementById('sortBy');
    if (sortSelect) {
        sortSelect.addEventListener('change', renderMembersList);
    }
    
    // Add member from list
    const addMemberFromListBtn = document.getElementById('addMemberFromList');
    if (addMemberFromListBtn) {
        addMemberFromListBtn.addEventListener('click', () => {
            resetForm();
            switchView('tree');
            Elements.nameInput.focus();
        });
    }
    
    // Edit member from info panel
    const editMemberBtn = document.getElementById('editMemberBtn');
    if (editMemberBtn) {
        editMemberBtn.addEventListener('click', () => {
            if (AppState.selectedMemberId) {
                populateForm(AppState.selectedMemberId);
                Elements.infoPanel.classList.remove('active');
            }
        });
    }
}

// UI Functions
function setupTabs() {
    // Form tabs
    document.querySelectorAll('.form-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.currentTarget.dataset.tab;
            switchFormTab(tabName);
        });
    });
    
    // Children select
    if (Elements.childrenSelect) {
        Elements.childrenSelect.addEventListener('change', updateSelectedChildrenDisplay);
    }
}

function setupPhotoUpload() {
    if (!Elements.photoUploadArea) return;
    
    Elements.photoUploadArea.addEventListener('click', () => {
        Elements.photoInput.click();
    });
    
    Elements.photoInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) {
                showToast('Please select an image file', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                Elements.photoPreview.src = event.target.result;
                Elements.photoPreviewContainer.classList.add('show');
                Elements.photoUploadArea.style.display = 'none';
                
                // Update preview info
                const previewInfo = document.querySelector('.preview-info');
                if (previewInfo) {
                    const sizeKB = Math.round(file.size / 1024);
                    previewInfo.querySelector('.preview-size').textContent = `${sizeKB} KB`;
                    previewInfo.querySelector('.preview-name').textContent = file.name;
                }
            };
            reader.readAsDataURL(file);
        }
    });
    
    if (Elements.removePhotoBtn) {
        Elements.removePhotoBtn.addEventListener('click', () => {
            Elements.photoPreview.src = '';
            Elements.photoPreviewContainer.classList.remove('show');
            Elements.photoUploadArea.style.display = 'flex';
            Elements.photoInput.value = '';
        });
    }
}

function switchView(view) {
    AppState.currentView = view;
    
    // Update active button
    document.querySelectorAll('.view-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    // Show/hide views
    const treeContainer = document.getElementById('treeContainer');
    const membersList = document.getElementById('membersList');
    
    if (view === 'tree') {
        if (treeContainer) treeContainer.style.display = 'block';
        if (membersList) membersList.style.display = 'none';
        renderTree();
    } else if (view === 'list') {
        if (treeContainer) treeContainer.style.display = 'none';
        if (membersList) membersList.style.display = 'block';
        renderMembersList();
    } else if (view === 'timeline') {
        if (treeContainer) treeContainer.style.display = 'block';
        if (membersList) membersList.style.display = 'none';
        showToast('Timeline view coming soon!', 'info');
    }
}

function switchFormTab(tabName) {
    // Update tabs
    document.querySelectorAll('.form-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Show content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
}

function updateSelectOptions() {
    const members = AppState.members;
    
    // Update all select elements
    const selects = [Elements.fatherSelect, Elements.motherSelect, Elements.spouseSelect, Elements.childrenSelect];
    
    selects.forEach(select => {
        if (!select) return;
        
        const currentValue = select.value;
        const isMultiple = select.multiple;
        
        // Clear options (keep first option)
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Filter members based on select type
        let filteredMembers = members;
        
        if (select === Elements.fatherSelect) {
            filteredMembers = members.filter(m => m.gender === 'male');
        } else if (select === Elements.motherSelect) {
            filteredMembers = members.filter(m => m.gender === 'female');
        }
        
        // Don't include currently editing member
        if (select === Elements.spouseSelect || select === Elements.childrenSelect) {
            filteredMembers = filteredMembers.filter(m => m.id !== Elements.memberId.value);
        }
        
        // Add options
        filteredMembers.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            
            let text = member.name;
            if (select !== Elements.fatherSelect && select !== Elements.motherSelect) {
                const genderSymbol = member.gender === 'male' ? '♂' : member.gender === 'female' ? '♀' : '⚧';
                text = `${member.name} ${genderSymbol}`;
            }
            
            option.textContent = text;
            select.appendChild(option);
        });
        
        // Restore previous value if still valid
        if (currentValue && filteredMembers.some(m => m.id === currentValue)) {
            select.value = currentValue;
        }
    });
}

function updateSelectedChildrenDisplay() {
    const selectedChildren = document.getElementById('selectedChildren');
    if (!selectedChildren || !Elements.childrenSelect) return;
    
    selectedChildren.innerHTML = '';
    
    const selectedOptions = Array.from(Elements.childrenSelect.selectedOptions);
    
    if (selectedOptions.length === 0) {
        selectedChildren.innerHTML = '<div class="no-selection">No children selected</div>';
        return;
    }
    
    selectedOptions.forEach(option => {
        const childId = option.value;
        const member = AppState.members.find(m => m.id === childId);
        if (member) {
            const chip = document.createElement('div');
            chip.className = 'child-chip';
            chip.innerHTML = `
                <span>${member.name}</span>
                <button type="button" class="remove-child" data-id="${childId}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            chip.querySelector('.remove-child').addEventListener('click', (e) => {
                e.stopPropagation();
                option.selected = false;
                updateSelectedChildrenDisplay();
            });
            
            selectedChildren.appendChild(chip);
        }
    });
}

function toggleNodeExpand(nodeId) {
    if (AppState.collapsedNodes.has(nodeId)) {
        AppState.collapsedNodes.delete(nodeId);
    } else {
        AppState.collapsedNodes.add(nodeId);
    }
    renderTree();
}

function selectNode(nodeId) {
    // Remove previous selection
    document.querySelectorAll('.node.selected').forEach(node => {
        node.classList.remove('selected');
    });
    
    // Add new selection
    const node = document.querySelector(`.node[data-id="${nodeId}"]`);
    if (node) {
        node.classList.add('selected');
        AppState.selectedMemberId = nodeId;
    }
}

function centerOnNode(nodeId) {
    const node = document.querySelector(`.node[data-id="${nodeId}"]`);
    if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        
        // Add highlight animation
        node.classList.add('highlight');
        setTimeout(() => {
            node.classList.remove('highlight');
        }, 2000);
    }
}

// Data Export/Import
function exportData() {
    const data = {
        members: AppState.members,
        metadata: {
            exportedAt: new Date().toISOString(),
            version: CONFIG.APP_VERSION,
            memberCount: AppState.members.length
        }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-tree-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Family tree exported successfully', 'success');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            if (!data.members || !Array.isArray(data.members)) {
                throw new Error('Invalid file format');
            }
            
            if (confirm(`Import ${data.members.length} members? This will replace your current data.`)) {
                AppState.members = data.members;
                AppState.collapsedNodes.clear();
                AppState.selectedMemberId = null;
                saveData();
                render();
                showToast(`Successfully imported ${data.members.length} members`, 'success');
            }
        } catch (error) {
            console.error('Import failed:', error);
            showToast('Failed to import data. Invalid file format.', 'error');
        }
        
        // Reset file input
        event.target.value = '';
    };
    
    reader.readAsText(file);
}

function clearAllData() {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
        AppState.members = [];
        AppState.collapsedNodes.clear();
        AppState.selectedMemberId = null;
        saveData();
        render();
        showToast('All data cleared', 'warning');
    }
}

// Member Details
function showMemberDetails(id) {
    const member = AppState.members.find(m => m.id === id);
    if (!member) return;
    
    // Update info panel
    document.getElementById('detailName').textContent = member.name;
    
    // Avatar
    const avatar = document.getElementById('detailAvatar');
    if (member.photo) {
        avatar.src = member.photo;
        avatar.style.display = 'block';
    } else {
        avatar.style.display = 'none';
    }
    
    // Gender and age
    const genderAge = document.getElementById('detailGenderAge');
    let genderAgeText = member.gender.charAt(0).toUpperCase() + member.gender.slice(1);
    if (member.dob) {
        const age = calculateAge(member.dob);
        genderAgeText += `, ${age} years old`;
    }
    genderAge.textContent = genderAgeText;
    
    // Basic info
    document.getElementById('detailDob').textContent = member.dob ? 
        new Date(member.dob).toLocaleDateString() : 'Not specified';
    document.getElementById('detailBirthPlace').textContent = member.birthPlace || 'Not specified';
    document.getElementById('detailOccupation').textContent = member.occupation || 'Not specified';
    
    // Relations
    const parents = [];
    if (member.father) {
        const father = AppState.members.find(m => m.id === member.father);
        if (father) parents.push(`Father: ${father.name}`);
    }
    if (member.mother) {
        const mother = AppState.members.find(m => m.id === member.mother);
        if (mother) parents.push(`Mother: ${mother.name}`);
    }
    document.getElementById('detailParents').textContent = parents.join(', ') || 'Not specified';
    
    if (member.spouse) {
        const spouse = AppState.members.find(m => m.id === member.spouse);
        document.getElementById('detailSpouse').textContent = spouse ? spouse.name : 'Unknown';
    } else {
        document.getElementById('detailSpouse').textContent = 'Not specified';
    }
    
    const children = member.children.map(childId => {
        const child = AppState.members.find(m => m.id === childId);
        return child ? child.name : 'Unknown';
    }).join(', ');
    document.getElementById('detailChildren').textContent = children || 'No children';
    
    // Biography
    const bioSection = document.getElementById('detailBioSection');
    const bioText = document.getElementById('detailBio');
    if (member.bio) {
        bioText.textContent = member.bio;
        bioSection.style.display = 'block';
    } else {
        bioSection.style.display = 'none';
    }
    
    // Show info panel
    Elements.infoPanel.classList.add('active');
    AppState.selectedMemberId = id;
}

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('family-tree-theme') || 'light';
    AppState.theme = savedTheme;
    document.body.setAttribute('data-theme', savedTheme);
    
    // Update toggle button
    if (Elements.themeToggle) {
        const icon = Elements.themeToggle.querySelector('.theme-icon i');
        const text = Elements.themeToggle.querySelector('.theme-text');
        
        if (savedTheme === 'dark') {
            icon.className = 'fas fa-sun';
            text.textContent = 'Light Mode';
        } else {
            icon.className = 'fas fa-moon';
            text.textContent = 'Dark Mode';
        }
    }
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.body.setAttribute('data-theme', newTheme);
    AppState.theme = newTheme;
    localStorage.setItem('family-tree-theme', newTheme);
    
    // Update toggle button
    const icon = Elements.themeToggle.querySelector('.theme-icon i');
    const text = Elements.themeToggle.querySelector('.theme-text');
    
    if (newTheme === 'dark') {
        icon.className = 'fas fa-sun';
        text.textContent = 'Light Mode';
    } else {
        icon.className = 'fas fa-moon';
        text.textContent = 'Dark Mode';
    }
    
    saveData();
    showToast(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode activated`, 'info');
}

// Utility Functions
function calculateAge(dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
}

function updateStatistics() {
    const members = AppState.members;
    
    const total = members.length;
    const male = members.filter(m => m.gender === 'male').length;
    const female = members.filter(m => m.gender === 'female').length;
    const other = members.filter(m => m.gender === 'other').length;
    
    // Update DOM
    if (Elements.totalMembers) Elements.totalMembers.textContent = total;
    if (Elements.maleCount) Elements.maleCount.textContent = male;
    if (Elements.femaleCount) Elements.femaleCount.textContent = female;
    
    // Update footer
    const treeStats = document.getElementById('treeStats');
    if (treeStats) {
        treeStats.textContent = `• ${total} Members • ${calculateGenerations()} Generations`;
    }
}

function calculateGenerations() {
    if (AppState.members.length === 0) return 0;
    
    // Simple generation calculation
    let maxGeneration = 1;
    AppState.members.forEach(member => {
        let generation = 1;
        let current = member;
        
        // Traverse up through parents
        while (current.father || current.mother) {
            generation++;
            if (current.father) {
                const father = AppState.members.find(m => m.id === current.father);
                current = father;
            } else if (current.mother) {
                const mother = AppState.members.find(m => m.id === current.mother);
                current = mother;
            }
        }
        
        if (generation > maxGeneration) {
            maxGeneration = generation;
        }
    });
    
    return maxGeneration;
}

function updateEmptyState() {
    if (!Elements.emptyState) return;
    
    if (AppState.members.length === 0) {
        Elements.emptyState.style.display = 'flex';
    } else {
        Elements.emptyState.style.display = 'none';
    }
}

function getGenderColor(gender) {
    switch (gender) {
        case 'male': return '#3b82f6';
        case 'female': return '#ec4899';
        default: return '#8b5cf6';
    }
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container || !Elements.toastTemplate) return;
    
    const template = Elements.toastTemplate.content.cloneNode(true);
    const toast = template.querySelector('.toast');
    toast.dataset.type = type;
    
    // Set icon
    const icon = toast.querySelector('.toast-icon i');
    switch (type) {
        case 'success': icon.className = 'fas fa-check-circle'; break;
        case 'error': icon.className = 'fas fa-exclamation-circle'; break;
        case 'warning': icon.className = 'fas fa-exclamation-triangle'; break;
        default: icon.className = 'fas fa-info-circle';
    }
    
    // Set message
    toast.querySelector('.toast-message').textContent = message;
    
    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    });
    
    // Auto-remove
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }
    }, 5000);
    
    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);
}

// Sample Data
function addSampleData() {
    const sampleMembers = [
        {
            id: 'sample_1',
            name: 'Rajesh Kumar',
            gender: 'male',
            dob: '1968-05-12',
            birthPlace: 'New Delhi, India',
            occupation: 'Engineer',
            email: 'rajesh.kumar@email.com',
            bio: 'Loves classical music and reading. Has been working as an engineer for 30 years.',
            photo: '',
            spouse: 'sample_2',
            father: null,
            mother: null,
            children: ['sample_3', 'sample_4'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: 'sample_2',
            name: 'Sushma Kumar',
            gender: 'female',
            dob: '1970-07-21',
            birthPlace: 'Mumbai, India',
            occupation: 'Doctor',
            email: 'sushma.kumar@email.com',
            bio: 'Pediatrician with 25 years of experience. Enjoys gardening and painting.',
            photo: '',
            spouse: 'sample_1',
            father: null,
            mother: null,
            children: ['sample_3', 'sample_4'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: 'sample_3',
            name: 'Amit Kumar',
            gender: 'male',
            dob: '1995-12-01',
            birthPlace: 'Bangalore, India',
            occupation: 'Software Developer',
            email: 'amit.kumar@email.com',
            bio: 'Full-stack developer passionate about AI and machine learning.',
            photo: '',
            spouse: null,
            father: 'sample_1',
            mother: 'sample_2',
            children: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: 'sample_4',
            name: 'Priya Kumar',
            gender: 'female',
            dob: '1998-09-18',
            birthPlace: 'Chennai, India',
            occupation: 'Graphic Designer',
            email: 'priya.kumar@email.com',
            bio: 'Creative designer specializing in branding and UI/UX design.',
            photo: '',
            spouse: null,
            father: 'sample_1',
            mother: 'sample_2',
            children: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    ];
    
    AppState.members = sampleMembers;
    saveData();
    render();
    showToast('Sample family tree loaded!', 'success');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    init();
    initTheme();
});