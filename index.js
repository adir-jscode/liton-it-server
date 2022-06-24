const express = require("express");
const app = express();
require("dotenv").config();
var jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const res = require("express/lib/response");
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lxpmm.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unAuthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    console.log("connected");

    const userCollection = await client.db("lion-it").collection("userInfo");
    const serviceCollection = await client.db("lion-it").collection("services");
    const confirmedService = await client.db("lion-it").collection("bookings");

    //VERIFY ADMIN
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const requester = await userCollection.findOne({ email: decodedEmail });
      if (requester.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "Forbidden Access" });
      }
    };

    //USER collection
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const info = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: info,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      var token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET);
      res.send({ result, token });
    });

    //get all users

    app.get("/user", verifyJWT, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // //MAKE ADMIN FROM USER COLLECTION

    // app.put("/user/admin/:email", async (req, res) => {
    //   const email = req.params.email;
    //   const filter = { email: email };
    //   const updateDoc = {
    //     $set: { role: "admin" },
    //   };
    //   const result = await userCollection.updateOne(filter, updateDoc);
    //   res.send(result);
    // });

    //MAKE ADMIN FROM USER COLLECTION with verification

    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //REMOVE ADMIN & TURNED INTO USER
    app.put("/user/customer/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;
      const requester = await userCollection.findOne({ email: decodedEmail });
      if (requester.role === "admin") {
        const filter = { email: email, role: "admin" };
        const updateDoc = {
          $set: { role: "user" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        res.status(403).send({ message: "Forbidden Access" });
      }
    });

    // USE HOOK FOR VERIFY ADMIN WITH ROUTE SETUP
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    //SERVICE COLLECTION
    // Post or add service

    app.post("/service", async (req, res) => {
      const service = req.body;
      const result = await serviceCollection.insertOne(service);
      res.send(result);
    });

    //get all services
    app.get("/service", async (req, res) => {
      const result = await serviceCollection.find().toArray();
      res.send(result);
    });

    //get service by _id
    app.get("/service/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await serviceCollection.findOne(filter);
      res.send(result);
    });

    //delete service
    app.delete("/service/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await serviceCollection.deleteOne(filter);
      res.send(result);
    });

    //Confirm service by user
    app.post("/booked", async (req, res) => {
      const bookingInfo = req.body;
      const result = await confirmedService.insertOne(bookingInfo);
      res.send(result);
    });

    //get order specific by email for user

    app.get("/booked/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await confirmedService.find(filter).toArray();
      res.send(result);
    });

    //get all confirmed order for manage the orders
    app.get("/booked", async (req, res) => {
      const result = await confirmedService.find().toArray();
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from agency!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
