const express = require("express");
const mongodb = require("mongodb");
const cors = require("cors");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");

const router = express();
router.use(express.json());
router.use(
  cors({
    origin: "https://gifted-shirley-74fd25.netlify.app/",
  })
);
dotenv.config();

const mongoClient = mongodb.MongoClient;
const objectId = mongodb.ObjectID;
const port = process.env.PORT || 5000;
const DB_URL = process.env.DBURL || "mongodb://127.0.0.1:27017";
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL,
    pass: PASSWORD,
  },
});

const mailData = {
  from: process.env.EMAIL,
  subject: "S*CR*T MES*AG*",
};

const mailMessage = (url) => {
  return `<div>
  <h3>Hi, </h3>
  <p>
    You have a SECRET MESSAGE waiting for you to open.</p>
    <a href='${url}' target='_blank'>${url}</a>
    <br>
    <p>Click above link to open the message</p>
    
  </div>`;
};

router.get("/", (req, res) => {
  res.status(200).send({
    message: "Hello world",
  });
});

router.post("/create-message", async (req, res) => {
  try {
    const client = await mongoClient.connect(DB_URL, {
      useUnifiedTopology: true,
    });
    const db = client.db("secretMessaging");
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(req.body.password, salt);
    const data = {
      key: req.body.randomKey,
      password: hash,
      message: req.body.message,
    };
    await db.collection("messages").insertOne(data);
    const result = await db.collection("messages").findOne({ key: data.key });
    const usrMailUrl = `${req.body.targetURL}?rs=${result._id}`;
    mailData.to = req.body.targetMail;
    mailData.html = mailMessage(usrMailUrl);

    transporter.sendMail(mailData, function (err, data) {
      if (err) {
        console.log(err);
      } else {
        console.log(data);
      }
    });
    res.status(200).json({
      message:
        "Secret message sent successfully. Don't Forget your secret key and password for future reference",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send(error.message);
  } finally {
    await client.close();
  }
});

router.get("/message-by-id/:id", async (req, res) => {
  try {
    const client = await mongoClient.connect(DB_URL);
    const db = client.db("secretMessaging");
    const result = await db
      .collection("messages")
      .find({ _id: objectId(req.params.id) })
      .project({ password: 0, _id: 0, key: 0 })
      .toArray();
    res
      .status(200)
      .json({ message: "Message have been fetched successfully", result });
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  } finally {
    client.close();
  }
});

router.delete("/delete-message", async (req, res) => {
  try {
    const client = await mongoClient.connect(DB_URL);
    const db = client.db("secretMessaging");
    const secret = await db
      .collection("messages")
      .findOne({ key: req.body.secretKey });
    if (secret) {
      const compare = await bcrypt.compare(req.body.password, secret.password);
      if (compare) {
        await db
          .collection("messages")
          .findOneAndDelete({ key: req.body.secretKey });
        res
          .status(200)
          .json({ message: "message has been deleted successfully" });
      } else {
        res.status(401).json({ message: "incorrect password!" });
      }
    } else {
      res.status(404).json({ message: "Secret Key not found!" });
    }
  } catch (error) {
    console.log(error);
  } finally {
    client.close();
  }
});

router.listen(port, () =>
  console.log(`::: Server is UP and running wonderfully ::: ${port}`)
);
