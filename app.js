require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const csrf = require("csurf");
const flash = require("connect-flash");
const multer = require("multer");
const helmet = require("helmet");
const compression = require("compression");
const errorController = require("./controllers/error");
const User = require("./models/user");
const morgan = require("morgan");

const app = express();

const csrfProtection = csrf();

// ✅ Multer Config - File Upload Setup
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images");
  },
  filename: (req, file, cb) => {
    cb(
      null,
      new Date().toISOString().replace(/:/g, "-") + "-" + file.originalname
    ); // ✅ Fixed invalid filename error
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.set("view engine", "ejs");
app.set("views", "views");

const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");

const acessLogStream = fs.createWriteStream(
  path.join(__dirname, "access.log"),
  {
    flags: "a",
  }
);

app.use(helmet());
app.use(compression());
app.use(morgan("combined", { stream: acessLogStream }));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("image")
);
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "images")));

// ✅ Session Configuration
app.use(
  session({
    secret: "my secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      dbName: "hop",
    }),
  })
);

app.use(csrfProtection);
app.use(flash());

// ✅ Middleware: Set Locals for Views
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session?.isLoggedIn || false;
  res.locals.csrfToken = req.csrfToken();
  next();
});

// ✅ Middleware: Set User if Session Exists
app.use((req, res, next) => {
  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then((user) => {
      if (!user) {
        return next();
      }
      req.user = user;
      next();
    })
    .catch((err) => {
      next(new Error(err));
    });
});

// ✅ Routes
app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

// ✅ 404 Error Page
app.use(errorController.get404);

// ✅ 500 Error Page Middleware
app.use((error, req, res, next) => {
  res.status(500).render("500", {
    pageTitle: "Error!",
    path: "/500",
    isAuthenticated: req.session?.isLoggedIn || false, // ✅ Check for session safety
  });
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then((result) => {
    console.log("MongoDB Connected...");
    app.listen(process.env.PORT || 3000);
  })
  .catch((err) => {
    console.log(err);
  });

// ✅ Debug Route to Check Session Data
app.get("/debug-session", (req, res) => {
  console.log("Session Data:", req.session);
  res.send(req.session);
});
