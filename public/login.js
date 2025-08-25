document.getElementById('loginForm').onsubmit = async function(e) {
    e.preventDefault();
    const form = e.target;
    const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: form.email.value,
            password: form.password.value
        })
    });
    const data = await res.json();
    if (data.error) {
        document.getElementById('loginError').innerText = data.error;
    } else if (data.changePassword) {
        document.getElementById('changePasswordModal').style.display = 'flex';
        document.querySelector('#changePasswordForm [name=userId]').value = data.userId;
    } else if (data.success) {
        window.location = '/home';
    }
};

document.getElementById('changePasswordForm').onsubmit = async function(e) {
    e.preventDefault();
    const form = e.target;
    const res = await fetch('/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: form.userId.value,
            password: form.password.value,
            password2: form.password2.value
        })
    });
    const data = await res.json();
    if (data.error) {
        document.getElementById('changePasswordError').innerText = data.error;
    } else if (data.success) {
        window.location = '/home';
    }
};
