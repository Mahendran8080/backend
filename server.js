import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// In-memory storage for books when MongoDB is not available
let booksStorage = [
  {
    _id: '1',
    bname: 'Introduction to Computer Science',
    bedition: '5th Edition',
    author: 'John Smith',
    imgurl: 'https://images.pexels.com/photos/159711/books-bookstore-book-reading-159711.jpeg?auto=compress&cs=tinysrgb&w=400',
    contactno: '+1234567890',
    contactemail: 'seller1@example.com',
    price: 45,
    originalprice: 80,
    createdAt: new Date()
  },
  {
    _id: '2',
    bname: 'Advanced Mathematics',
    bedition: '3rd Edition',
    author: 'Jane Doe',
    imgurl: 'https://images.pexels.com/photos/301920/pexels-photo-301920.jpeg?auto=compress&cs=tinysrgb&w=400',
    contactno: '+1234567891',
    contactemail: 'seller2@example.com',
    price: 35,
    originalprice: 65,
    createdAt: new Date()
  },
  {
    _id: '3',
    bname: 'Physics Fundamentals',
    bedition: '2nd Edition',
    author: 'Robert Johnson',
    imgurl: 'https://images.pexels.com/photos/256541/pexels-photo-256541.jpeg?auto=compress&cs=tinysrgb&w=400',
    contactno: '+1234567892',
    contactemail: 'seller3@example.com',
    price: 40,
    originalprice: 70,
    createdAt: new Date()
  }
];

let isMongoConnected = false;
let Book;

// MongoDB connection with fallback
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/college-books';

// Book Schema
const bookSchema = new mongoose.Schema({
  bname: { type: String, required: true },
  bedition: { type: String, required: true },
  author: { type: String, required: true },
  imgurl: { type: String, required: true },
  contactno: { type: String, required: true },
  contactemail: { type: String, required: true },
  price: { type: Number, required: true },
  originalprice: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Try to connect to MongoDB
mongoose.connect('mongodb+srv://mahendrancool18:Mahendran123@bookdata.vjitsf2.mongodb.net/?retryWrites=true&w=majority&appName=BookData')
  .then(() => {
    console.log('Connected to MongoDB');
    isMongoConnected = true;
    Book = mongoose.model('Book', bookSchema);
  })
  .catch(err => {
    console.log('MongoDB not available, using in-memory storage');
    console.log('To use MongoDB, please set up a MongoDB Atlas connection or local MongoDB instance');
    isMongoConnected = false;
  });

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Helper function to generate ID for in-memory storage
function generateId() {
  return Date.now().toString();
}

// Routes

// Get all books with optional search and filters
app.get('/api/books', async (req, res) => {
  try {
    const { search, author, edition } = req.query;
    
    if (isMongoConnected && Book) {
      // Use MongoDB
      let query = {};

      if (search) {
        query.$or = [
          { bname: { $regex: search, $options: 'i' } },
          { author: { $regex: search, $options: 'i' } }
        ];
      }

      if (author) {
        query.author = { $regex: author, $options: 'i' };
      }

      if (edition) {
        query.bedition = { $regex: edition, $options: 'i' };
      }

      const books = await Book.find(query).sort({ createdAt: -1 });
      res.json(books);
    } else {
      // Use in-memory storage
      let filteredBooks = [...booksStorage];

      if (search) {
        const searchLower = search.toLowerCase();
        filteredBooks = filteredBooks.filter(book => 
          book.bname.toLowerCase().includes(searchLower) ||
          book.author.toLowerCase().includes(searchLower)
        );
      }

      if (author) {
        const authorLower = author.toLowerCase();
        filteredBooks = filteredBooks.filter(book => 
          book.author.toLowerCase().includes(authorLower)
        );
      }

      if (edition) {
        const editionLower = edition.toLowerCase();
        filteredBooks = filteredBooks.filter(book => 
          book.bedition.toLowerCase().includes(editionLower)
        );
      }

      // Sort by creation date (newest first)
      filteredBooks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      res.json(filteredBooks);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new book
app.post('/api/books', upload.single('image'), async (req, res) => {
  try {
    const bookData = {
      ...req.body,
      price: Number(req.body.price),
      originalprice: Number(req.body.originalprice)
    };

    if (req.file) {
      bookData.imgurl = `/uploads/${req.file.filename}`;
    }

    if (isMongoConnected && Book) {
      // Use MongoDB
      const book = new Book(bookData);
      await book.save();
      res.status(201).json(book);
    } else {
      // Use in-memory storage
      const newBook = {
        _id: generateId(),
        ...bookData,
        createdAt: new Date()
      };
      booksStorage.unshift(newBook);
      res.status(201).json(newBook);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a book
app.delete('/api/books/:id', async (req, res) => {
  try {
    if (isMongoConnected && Book) {
      // Use MongoDB
      const book = await Book.findByIdAndDelete(req.params.id);
      if (!book) {
        return res.status(404).json({ error: 'Book not found' });
      }
      res.json({ message: 'Book deleted successfully' });
    } else {
      // Use in-memory storage
      const bookIndex = booksStorage.findIndex(book => book._id === req.params.id);
      if (bookIndex === -1) {
        return res.status(404).json({ error: 'Book not found' });
      }
      booksStorage.splice(bookIndex, 1);
      res.json({ message: 'Book deleted successfully' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create uploads directory if it doesn't exist
import fs from 'fs';
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (!isMongoConnected) {
    console.log('Note: Using in-memory storage. Data will not persist between server restarts.');
    console.log('To use persistent storage, set up MongoDB Atlas or a local MongoDB instance.');
  }
});