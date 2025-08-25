async function getProfile() {
    const res = await fetch('/api/profile');
    return await res.json();
}

function renderAvatar(user) {
    if (user.Photo) {
        return `<img src="/uploads/${user.Photo}" class="avatar" alt="photo">`;
    } else {
        const initials = (user.FirstName[0] + user.LastName[0]).toUpperCase();
        return `<div class="avatar" style="background:#888;">${initials}</div>`;
    }
}

async function renderHeader() {
    const user = await getProfile();
    document.getElementById('userHeader').innerHTML = `<a href="#" id="profileLink">${renderAvatar(user)} ${user.FirstName} ${user.LastName}</a>`;
    document.getElementById('profileLink').onclick = () => showDetailsModal('user', user.Id);
}

async function renderTab(tab) {
    let url = tab === 'clients' ? '/api/clients' : '/api/users';
    const res = await fetch(url);
    const list = await res.json();
    let html = `<button onclick="showDetailsModal('${tab}','new')">New ${tab.slice(0,-1).charAt(0).toUpperCase() + tab.slice(1,-1)}</button>`;
    html += `<table class="list-table"><thead><tr><th>Id</th><th>Last Name</th><th>First Name</th><th>Email</th><th>Active</th><th></th></tr></thead><tbody>`;
    for (const item of list) {
        html += `<tr><td>${item.Id}</td><td>${item.LastName}</td><td>${item.FirstName}</td><td>${item.Email}</td><td>${item.Active ? 'Yes' : 'No'}</td><td><span class="edit-icon" onclick="showDetailsModal('${tab}',${item.Id})">&#9998;</span></td></tr>`;
    }
    html += '</tbody></table>';
    document.getElementById('tabContent').innerHTML = html;
}

async function showDetailsModal(type, id) {
    let isNew = id === 'new';
    let url = isNew ? null : `/api/${type}/${id}`;
    let data = isNew ? {} : await (await fetch(url)).json();
    let fields = type === 'clients' ? [
        'FirstName','LastName','Email','Active','Comments','Phone','Address','City','State','Zip','Country','DateOfBirth','Gender','Password','Password2'
    ] : [
        'FirstName','LastName','Email','Active','Comments','Password','Password2'
    ];
    let html = `<div class="modal-content"><h3>${isNew ? 'New' : ''} ${type.slice(0,-1).charAt(0).toUpperCase() + type.slice(1,-1)} Details</h3>`;
    html += `<form id="detailsForm">`;
    for (const f of fields) {
        if (f === 'Password' || f === 'Password2') {
            html += `<input type="password" name="${f}" placeholder="${f === 'Password' ? 'New Password' : 'Repeat Password'}"><br>`;
        } else if (f === 'Active') {
            html += `<label>Active <input type="checkbox" name="Active" ${data.Active ? 'checked' : ''}></label><br>`;
        } else if (f === 'DateOfBirth') {
            html += `<label>Date of Birth <input type="date" name="DateOfBirth" value="${data.DateOfBirth || ''}"></label><br>`;
        } else if (f === 'Gender') {
            html += `<label>Gender <select name="Gender"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></label><br>`;
        } else {
            html += `<input type="text" name="${f}" value="${data[f] || ''}" placeholder="${f}"><br>`;
        }
    }
    html += `<label>Photo <input type="file" name="photo"></label><br>`;
    html += `<button type="submit">Save</button> <button type="button" onclick="closeModal()">Close</button>`;
    html += `<div id="detailsError" class="error"></div>`;
    html += `</form></div>`;
    document.getElementById('detailsModal').innerHTML = html;
    document.getElementById('detailsModal').style.display = 'flex';
    document.getElementById('detailsForm').onsubmit = async function(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        let endpoint = isNew ? `/api/${type}` : `/api/${type}/${id}`;
        const res = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });
        const result = await res.json();
        if (result.error) {
            document.getElementById('detailsError').innerText = result.error;
        } else {
            closeModal();
            renderTab(type);
        }
    };
}

function closeModal() {
    document.getElementById('detailsModal').style.display = 'none';
}

document.querySelectorAll('.tab').forEach(btn => {
    btn.onclick = function() {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTab(btn.dataset.tab);
    };
});

renderHeader();
document.querySelector('.tab').classList.add('active');
renderTab('clients');
