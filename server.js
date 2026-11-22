import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

// --- Middleware Configuration ---
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serves index.html & dashboard.html directly from root folder

// --- Database Connection ---
const dbURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/blogplatform';

mongoose.connect(dbURI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// --- Schemas & Models ---
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const BlogSchema = new mongoose.Schema({
  title: String,
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: String,
  comments: [{
    username: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });
const Blog = mongoose.model('Blog', BlogSchema);

// --- Auth Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  // Added backup secret key fallback so authentication matches login token generation
  jwt.verify(token, process.env.JWT_SECRET || 'my_super_secret_backup_key_123', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// --- Routes ---

// Register User
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  
  // Added both id AND username inside token payload so blog creation can reference the author
  const token = jwt.sign(
    { id: user._id, username: user.username }, 
    process.env.JWT_SECRET || 'my_super_secret_backup_key_123', 
    { expiresIn: '1h' }
  );
  res.json({ token, username: user.username, userId: user._id });
});

// Get all blogs
app.get('/api/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
});

// Create blog
app.post('/api/blogs', authenticateToken, async (req, res) => {
  try {
    const { title, content } = req.body;
    const newBlog = new Blog({ 
      title, 
      content, 
      author: req.user.id, 
      authorName: req.user.username 
    });
    await newBlog.save();
    res.status(201).json(newBlog);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create blog' });
  }
});

// Update blog
app.put('/api/blogs/:id', authenticateToken, async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) return res.status(404).json({ error: 'Blog not found' });
  if (blog.author.toString() !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
  
  blog.title = req.body.title || blog.title;
  blog.content = req.body.content || blog.content;
  await blog.save();
  res.json(blog);
});

// Delete blog
app.delete('/api/blogs/:id', authenticateToken, async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) return res.status(404).json({ error: 'Blog not found' });
  if (blog.author.toString() !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
  
  await blog.deleteOne();
  res.json({ message: 'Blog deleted' });
});

// Add Comment
app.post('/api/blogs/:id/comments', authenticateToken, async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) return res.status(404).json({ error: 'Blog not found' });
  
  const comment = { username: req.user.username, text: req.body.text };
  blog.comments.push(comment);
  await blog.save();
  res.status(201).json(blog);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));