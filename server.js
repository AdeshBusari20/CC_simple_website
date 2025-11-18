const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/student_portal';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB Error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Course Schema
const courseSchema = new mongoose.Schema({
  code: { type: String, required: true },
  title: { type: String, required: true },
  instructor: { type: String, required: true },
  schedule: { type: String, required: true },
  credits: { type: Number, required: true },
  availability: { type: String, required: true }
});

const Course = mongoose.model('Course', courseSchema);

// Enrollment Schema
const enrollmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  enrolledAt: { type: Date, default: Date.now }
});

const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Routes

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { fullName, email, phoneNumber, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      fullName,
      email,
      phoneNumber,
      password: hashedPassword
    });

    await user.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all courses
app.get('/api/courses', authenticateToken, async (req, res) => {
  try {
    const courses = await Course.find();
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get enrolled courses
app.get('/api/enrolled-courses', authenticateToken, async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ userId: req.user.userId })
      .populate('courseId');
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Enroll in course
app.post('/api/enroll', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.body;

    // Check if already enrolled
    const existing = await Enrollment.findOne({
      userId: req.user.userId,
      courseId
    });

    if (existing) {
      return res.status(400).json({ message: 'Already enrolled in this course' });
    }

    const enrollment = new Enrollment({
      userId: req.user.userId,
      courseId
    });

    await enrollment.save();
    res.json({ message: 'Enrolled successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Seed courses (run once to populate database)
app.post('/api/seed-courses', async (req, res) => {
  try {
    const courses = [
      {
        code: 'CS101',
        title: 'Introduction to Computer Science',
        instructor: 'Dr. Smith',
        schedule: 'Mon/Wed 10:00-11:30',
        credits: 3,
        availability: '50 seats left'
      },
      {
        code: 'MATH201',
        title: 'Calculus I',
        instructor: 'Prof. Johnson',
        schedule: 'Tue/Thu 13:00-14:30',
        credits: 4,
        availability: '40 seats left'
      },
      {
        code: 'ENG105',
        title: 'Academic Writing',
        instructor: 'Dr. Williams',
        schedule: 'Mon/Wed 14:00-15:30',
        credits: 3,
        availability: '35 seats left'
      },
      {
        code: 'PHYS202',
        title: 'University Physics',
        instructor: 'Prof. Brown',
        schedule: 'Tue/Thu 10:00-11:30',
        credits: 4,
        availability: '40 seats left'
      },
      {
        code: 'CHEM101',
        title: 'General Chemistry',
        instructor: 'Dr. Davis',
        schedule: 'Mon/Wed/Fri 09:00-10:00',
        credits: 4,
        availability: '45 seats left'
      },
      {
        code: 'BIO150',
        title: 'Biology for Majors',
        instructor: 'Prof. Miller',
        schedule: 'Tue/Thu 15:00-16:30',
        credits: 4,
        availability: '30 seats left'
      }
    ];

    await Course.deleteMany({});
    await Course.insertMany(courses);
    res.json({ message: 'Courses seeded successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});