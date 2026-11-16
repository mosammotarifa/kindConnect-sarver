const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const { createRemoteJWKSet, jwtVerify } = require("jose");
let jose;

async function getJose() {
  if (!jose) {
    jose = await import("jose");
  }
  return jose;
}



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
    const bookingCollection = db.collection("booking");
    await bookingCollection.createIndex(
      { eventId: 1, userId: 1 },
      { unique: true },
    );
    // const JWKS = createRemoteJWKSet(
    //   new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
    // );
    // const verifyToken = async (req, res, next) => {
    //   try {
    //     const authHeader = req.headers.authorization;

    //     if (!authHeader?.startsWith("Bearer ")) {
    //       return res.status(401).send({
    //         message: "Unauthorized: Token missing",
    //       });
    //     }

    //     const token = authHeader.split(" ")[1];

    //     const { payload } = await jwtVerify(token, JWKS);

    //     req.user = payload;

    //     next();
    //   } catch (error) {
    //     console.error("JWT verification error:", error.message);

    //     return res.status(401).send({
    //       message: "Invalid token",
    //     });
    //   }
    // };

const { createRemoteJWKSet, jwtVerify } = await getJose();

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).send({
        message: "Unauthorized: Token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload;

    next();
  } catch (error) {
    console.error("JWT verification error:", error.message);

    return res.status(401).send({
      message: "Invalid token",
    });
  }
};

    app.post("/create-event", verifyToken, async (req, res) => {
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
        const data = eventCollection.find().sort({ _id: -1 });
        const result = await data.toArray();
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "failed to send data to client side." });
      }
    });
    app.get("/create-event/organizer/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const filter = { email: email };
        const result = await eventCollection.find(filter).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "failed to send data through email" });
      }
    });
    app.patch("/create-event/:id", verifyToken, async (req, res) => {
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
    app.delete("/create-event/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const data = { _id: new ObjectId(id) };
        const result = await eventCollection.deleteOne(data);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "failed to send deleted " });
      }
    });
    app.get("/create-event/:id", verifyToken, async (req, res) => {
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
    app.post("/booking", verifyToken, async (req, res) => {
      try {
        const data = req.body;
        const { eventId, userId, userEmail } = data;

        if (!eventId || !userId || !userEmail) {
          return res
            .status(400)
            .send({ message: "Missing booking information" });
        }

        const eventObjectId = new ObjectId(eventId);

        const alreadyJoined = await bookingCollection.findOne({
          eventId,
          userId,
        });

        if (alreadyJoined) {
          return res.status(409).send({ message: "Already joined this event" });
        }

        const updatedEvent = await eventCollection.updateOne(
          {
            _id: eventObjectId,
            $expr: {
              $lt: [{ $ifNull: ["$joinedCount", 0] }, "$capacity"],
            },
          },
          {
            $inc: { joinedCount: 1 },
          },
        );

        if (updatedEvent.modifiedCount === 0) {
          return res.status(400).send({
            message: "Event is full or does not exist",
          });
        }

        try {
          const result = await bookingCollection.insertOne(data);

          return res.status(201).send({
            message: "Successfully joined event",
            result,
          });
        } catch (error) {
          // Restore count if booking insertion fails
          await eventCollection.updateOne(
            { _id: eventObjectId },
            { $inc: { joinedCount: -1 } },
          );

          if (error.code === 11000) {
            return res.status(409).send({
              message: "Already joined this event",
            });
          }

          throw error;
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to join event" });
      }
    });
    app.get(
      "/booking/check/:eventId/:userId",
      verifyToken,
      async (req, res) => {
        try {
          const { eventId, userId } = req.params;

          const joined = await bookingCollection.findOne({
            eventId,
            userId,
          });

          res.send({ isJoined: Boolean(joined) });
        } catch (error) {
          res.status(500).send({ message: "Failed to check join status" });
        }
      },
    );
    app.delete("/booking/:eventId/:userId", verifyToken, async (req, res) => {
      try {
        const { eventId, userId } = req.params;

        const eventObjectId = new ObjectId(eventId);

        const result = await bookingCollection.deleteOne({
          eventId,
          userId,
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({
            message: "Booking not found",
          });
        }

        // Restore available capacity
        await eventCollection.updateOne(
          { _id: eventObjectId, joinedCount: { $gt: 0 } },
          { $inc: { joinedCount: -1 } },
        );

        res.send({ message: "Successfully left the event" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to undo joining" });
      }
    });
    app.get("/booking/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const data = { userEmail: email };
        const result = await bookingCollection.find(data).toArray();
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "failed to send data by email in booking card" });
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
