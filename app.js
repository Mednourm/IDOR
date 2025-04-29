const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  name: 'SessionID',
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 600000
  }
}));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Simulated user database
const users = [
  { id: 1, username: 'carlos', password: 'supersecret123!', chatId: 1 },
  { id: 2, username: 'admin', password: 'admin123', chatId: 2 },
  {id: 3, username: 'elhadi', password: 'med', chatId: 3 }
];
 
// Create chats directory if it doesn't exist
const CHATS_DIR = path.join(__dirname, 'chats');
if (!fs.existsSync(CHATS_DIR)) {
  fs.mkdirSync(CHATS_DIR);
}

// Create default chat files if they don't exist
const carlosChatPath = path.join(CHATS_DIR, '1.txt');
if (!fs.existsSync(carlosChatPath)) {
  const carlosChatContent = `
User: carlos
Time: ${new Date().toISOString()}
Message: I forgot my password. Can you help?

Support Response: Thanks for contacting support. For verification, your password is supersecret123!. We recommend changing it soon.
`;
  fs.writeFileSync(carlosChatPath, carlosChatContent);
}

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/login');
};

// Middleware to redirect if already authenticated
const redirectIfAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  next();
};

// Route: Lab Introduction
app.get('/', (req, res) => {
  res.render('index');
});

// Route: Login Page
app.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('login', { error: null });
});

// Route: Login Submission
app.post('/login', redirectIfAuthenticated, (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    req.session.user = { 
      id: user.id, 
      username: user.username,
      chatId: user.chatId
    };
   // console.log('Session details:', req.session);
    return res.redirect('/dashboard');
  }
  
  res.render('login', { error: 'Invalid username or password' });
});

// Route: User Dashboard
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.render('dashboard', { user: req.session.user });
});

// Route: Support Chat
app.get('/support-chat', isAuthenticated, (req, res) => {
  const user = req.session.user;
  const chatId = user.chatId;
  const chatFilename = `${chatId}.txt`;
  const chatPath = path.join(CHATS_DIR, chatFilename);
  
  if (!fs.existsSync(chatPath) && user.username !== 'carlos') {
    const defaultChatContent = `
User: ${user.username}
Time: ${new Date().toISOString()}
Message: Initial message

Support Response: Hello ${user.username}! How can we help you today?
`;
    fs.writeFileSync(chatPath, defaultChatContent);
  }
  
  res.render('chat', { user: req.session.user });
});

// Route: Send Message
app.post('/send-message', isAuthenticated, (req, res) => {
  const { message } = req.body;
  const user = req.session.user;

  if (!message) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  const chatId = user.chatId;
  const chatFilename = `${chatId}.txt`;
  const chatPath = path.join(CHATS_DIR, chatFilename);
  
  let existingContent = '';
  if (fs.existsSync(chatPath)) {
    existingContent = fs.readFileSync(chatPath, 'utf8');
  }

  const timestamp = new Date().toISOString();
  const newMessage = `
User: ${user.username}
Time: ${timestamp}
Message: ${message}

Support Response: Thanks for contacting support. How can we help you today?
`;

  const chatContent = existingContent + newMessage;
  fs.writeFileSync(chatPath, chatContent);

  res.json({ 
    success: true, 
    chatId: chatId
  });
});

// Route: Vulnerable Download (redirect)
app.post('/download-transcript', isAuthenticated, (req, res) => {
  const user = req.session.user;
  res.redirect(`/download-transcript/${user.chatId}.txt`);
});


const canAccessTranscript = (req, res, next) => {
  const requestedFile = req.params.filename;
  const userChatId = req.session.user.chatId;
  const expectedFile = `${userChatId}.txt`;

  if (requestedFile !== expectedFile) {
    return res.status(403).render('error', { message: 'Access denied: Unauthorized transcript access' });
  }

  next();
};


// Route: File Download Handler (IDOR vulnerability)
app.get('/download-transcript/:filename', isAuthenticated,/*canAccessTranscript*/(req, res) => {
  const filename = req.params.filename;
  const chatPath = path.join(CHATS_DIR, filename);

  if (fs.existsSync(chatPath)) {
    res.download(chatPath, filename, (err) => {
      if (err) {
        res.status(404).render('error', { message: 'Chat transcript not found' });
      }
    });
  } else {
    res.status(404).render('error', { message: 'Chat transcript not found' });
  }
});


// Route: Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.clearCookie('SessionID');
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
