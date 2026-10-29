import express from "express";
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';
import cors from "cors";
import { createRemoteJWKSet, jwtVerify } from "jose";


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
    // Fail fast with a clear message instead of letting `mongoClient.db()`
    // crash later with a confusing "Cannot read properties of undefined".
    throw new Error("MongoDB connection failed — check MONGODB_URI");
  }
}

const mongoClient = await connectToMongoDB();
const db = mongoClient.db("wanderlust");
const destinationCollection = db.collection("destinations")
const bookingCollection = db.collection("bookings")



const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.error("JWT verify failed:", error.message);
    return res.status(401).send({ msg: "Invalid token!" });
  }
};



app.post("/add-destination", verifyToken, async (req, res) => {
  const data = req.body;
  const result = await destinationCollection.insertOne(data);

  console.log(result)

  res.send(result);
})

app.get("/destinations", async(req, res) => {
  const result = await destinationCollection.find().toArray();
  res.send(result);
})

app.get("/featured-destinations", async(req, res) => {
  const result = await destinationCollection.find().limit(5).toArray();
  res.send(result);
})

// Public so guests can view a destination before signing up (Plan A).
// Mutations (add/edit/delete) and my-bookings still require a token.
app.get("/destination/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const result = await destinationCollection.findOne({ _id: new ObjectId(id) });
    if (!result) {
      return res.status(404).json({ message: "Destination not found" });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.patch("/destination/:id", verifyToken, async(req, res) => {
  const {id} = req.params;
  const updatedData = req.body;
  const result = await destinationCollection.updateOne(
    {_id: new ObjectId(id)},
    {$set: updatedData}
  )
  res.json(result);
})

app.delete("/destination/:id", verifyToken, async(req, res) => {
  const {id} = req.params;
  const result = await destinationCollection.deleteOne({_id: new ObjectId(id)});
  res.json(result);
})



          //  Booking Part

app.post("/booking", async (req, res) => {
  try {
    // Ignore any _id sent by the client. The old client spread the
    // destination's _id into the payload, so booking the same destination
    // twice hit a duplicate-key error (500). Let MongoDB generate a new one.
    const { _id, ...data } = req.body;
    const result = await bookingCollection.insertOne(data);
    res.json(result);
  } catch (error) {
    console.error("POST /booking failed:", error);
    res.status(500).json({ message: "Failed to create booking" });
  }
})

app.get("/my-bookings/:email", verifyToken, async (req, res) => {
  try {
    const { email } = req.params;
    const result = await bookingCollection.find({ userEmail: email }).toArray();
    res.json(result);
  } catch (error) {
    console.error("GET /my-bookings failed:", error);
    res.status(500).json({ message: "Failed to load bookings" });
  }
})

app.delete("/my-bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    // New bookings have an ObjectId _id; bookings created before the fix
    // carry the destination's _id as a plain string — match either.
    const result = await bookingCollection.deleteOne({
      $or: [{ _id: new ObjectId(id) }, { _id: id }],
    });
    res.json(result);
  } catch (error) {
    console.error("DELETE /my-bookings failed:", error);
    res.status(500).json({ message: "Failed to cancel booking" });
  }
})


app.get("/", (req, res) => {
    res.send({message: 'Server is running fine'});
})

// Vercel serverless functions use the exported app directly — only listen
// on a port when the file is run locally (node index.js).
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Wonderlust running from port ${PORT}`);
  });
}

export default app;