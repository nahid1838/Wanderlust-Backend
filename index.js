import express from "express";
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';
import cors from "cors";


const app = express();
const PORT = 5000;

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
  }
}

const mongoClient = await connectToMongoDB();
const db = mongoClient.db("wanderlust");
const destinationCollection = db.collection("destinations")

app.post("/add-destination", async (req, res) => {
  const data = req.body;
  const result = await destinationCollection.insertOne(data);

  console.log(result)

  res.send(result);
})

app.get("/destinations", async(req, res) => {
  const result = await destinationCollection.find().toArray();
  res.send(result);
})

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

app.patch("/destination/:id", async(req, res) => {
  const {id} = req.params;
  const updatedData = req.body;
  const result = await destinationCollection.updateOne(
    {_id: new ObjectId(id)},
    {$set: updatedData}
  )
  res.json(result);
})

app.delete("/destination/:id", async(req, res) => {
  const {id} = req.params;
  const result = await destinationCollection.deleteOne({_id: new ObjectId(id)});
  res.json(result);
})


app.get("/", (req, res) => {
    res.send({message: 'Server is running fine'});
})

app.listen(PORT, () => {
    console.log(`Wonderlust running from port ${PORT}`);
})