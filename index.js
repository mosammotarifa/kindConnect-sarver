const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const run = async () => {
  try {
    await client.connect();
    const db = client.db("social-event");
    const eventCollection = db.collection("event");
    app.post("/create-event", async (req, res) => {
      try {
        const data = req.body;
        const result = await eventCollection.insertOne(data);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "failed to post create-event" });
      }
    });
    app.get("/create-event", async (req, res) => {
      try {
        const data = eventCollection.find();
        const result = await data.toArray();
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "failed to send data to client side." });
      }
    });
    app.get("/create-event/organizer/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const filter = { email: email };
        const result = await eventCollection.find(filter).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "failed to send data through email" });
      }
    });
    app.patch("/create-event/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const query = { _id: new ObjectId(id) };
        const data = req.body;
        const updated = { $set: data };
        const result = await eventCollection.updateOne(query, updated);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "failed to update send " });
      }
    });
    app.delete("/create-event/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const data = { _id: new ObjectId(id) };
        const result = await eventCollection.deleteOne(data);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "failed to send deleted " });
      }
    });
    app.get("/create-event/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const query = { _id: new ObjectId(id) };
        const result = await eventCollection.findOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "failed to get single data from create-event data",
        });
      }
    });
    await client.db("admin").command({ ping: 1 });
    console.log("successfully  pinged ");
    app.listen(port, () => {
      console.log(" server goes onnnnnnnnn");
    });
  } finally {
    // await client.close();
  }
};
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send({ message: "server is now on" });
});
