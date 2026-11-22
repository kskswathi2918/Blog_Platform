const API_URL = 'http://localhost:5000/api';

// Check which page we are on
const authForm = document.getElementById('auth-form');
const blogList = document.getElementById('blog-list');

// --- AUTHENTICATION PAGE LOGIC ---
if (authForm) {
    const toggleAuth = document.getElementById('toggle-auth');
    const authTitle = document.getElementById('auth-title');
    const submitBtn = document.getElementById('submit-btn');
    const toggleText = document.getElementById('toggle-text');
    let isLogin = true;

    toggleAuth.addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        authTitle.innerText = isLogin ? 'Login to BlogPlatform' : 'Create an Account';
        submitBtn.innerText = isLogin ? 'Login' : 'Register';
        toggleText.innerText = isLogin ? "Don't have an account?" : "Already have an account?";
        toggleAuth.innerText = isLogin ? 'Register here' : 'Login here';
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const endpoint = isLogin ? '/auth/login' : '/auth/register';

        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            if (isLogin) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', data.username);
                localStorage.setItem('userId', data.userId);
                window.location.href = 'dashboard.html';
            } else {
                alert('Registration successful! Please login.');
                isLogin = true;
                toggleAuth.click();
            }
        } else {
            alert(data.error);
        }
    });
}

// --- DASHBOARD LOGIC ---
if (blogList) {
    const token = localStorage.getItem('token');
    const currentUserId = localStorage.getItem('userId');
    if (!token) window.location.href = 'index.html';

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });

    const fetchBlogs = async () => {
        const res = await fetch(`${API_URL}/blogs`);
        const blogs = await res.json();
        blogList.innerHTML = '';

        blogs.forEach(blog => {
            const isAuthor = blog.author === currentUserId;
            const commentHTML = blog.comments.map(c => `
                <div class="comment">
                    <span class="comment-author">${c.username}:</span>${c.text}
                </div>
            `).join('');

            const blogCard = document.createElement('div');
            blogCard.className = 'card';
            blogCard.innerHTML = `
                <h2>${blog.title}</h2>
                <div class="meta">By ${blog.authorName} on ${new Date(blog.createdAt).toLocaleDateString()}</div>
                <p style="white-space: pre-wrap;">${blog.content}</p>
                
                ${isAuthor ? `
                    <button onclick="editBlog('${blog._id}', '${escape(blog.title)}', '${escape(blog.content)}')">Edit</button>
                    <button class="btn-danger" onclick="deleteBlog('${blog._id}')">Delete</button>
                ` : ''}

                <div class="comment-section">
                    <h4>Comments</h4>
                    <div>${commentHTML}</div>
                    <div style="display:flex; margin-top:10px;">
                        <input type="text" id="c-input-${blog._id}" placeholder="Write a comment..." style="margin:0; border-radius: 4px 0 0 4px;">
                        <button onclick="addComment('${blog._id}')" style="border-radius: 0 4px 4px 0;">Post</button>
                    </div>
                </div>
            `;
            blogList.appendChild(blogCard);
        });
    };

    // Create or Update Blog
    document.getElementById('save-blog-btn').addEventListener('click', async () => {
        const id = document.getElementById('blog-id').value;
        const title = document.getElementById('blog-title').value;
        const content = document.getElementById('blog-content').value;
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/blogs/${id}` : `${API_URL}/blogs`;

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title, content })
        });

        if (res.ok) {
            clearBlogForm();
            fetchBlogs();
        }
    });

    window.editBlog = (id, title, content) => {
        document.getElementById('blog-id').value = id;
        document.getElementById('blog-title').value = unescape(title);
        document.getElementById('blog-content').value = unescape(content);
        document.getElementById('form-heading').innerText = "Edit Post";
        document.getElementById('save-blog-btn').innerText = "Update Post";
        document.getElementById('cancel-edit-btn').style.display = "inline-block";
    };

    const clearBlogForm = () => {
        document.getElementById('blog-id').value = '';
        document.getElementById('blog-title').value = '';
        document.getElementById('blog-content').value = '';
        document.getElementById('form-heading').innerText = "Create a New Post";
        document.getElementById('save-blog-btn').innerText = "Publish Post";
        document.getElementById('cancel-edit-btn').style.display = "none";
    };

    document.getElementById('cancel-edit-btn').addEventListener('click', clearBlogForm);

    window.deleteBlog = async (id) => {
        if (!confirm('Are you sure?')) return;
        await fetch(`${API_URL}/blogs/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchBlogs();
    };

    window.addComment = async (blogId) => {
        const input = document.getElementById(`c-input-${blogId}`);
        if (!input.value.trim()) return;

        await fetch(`${API_URL}/blogs/${blogId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text: input.value })
        });
        input.value = '';
        fetchBlogs();
    };

    fetchBlogs();
}