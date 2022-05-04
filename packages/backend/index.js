var express = require("express");
var cors = require("cors");
var bodyParser = require("body-parser");
var app = express();
let transactions = {};

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.get("/", function (req, res) {
  console.log("/");
  res.status(200).send("hello world");
});
app.get("/:address", function (req, res) {
  let address = req.params.address;
  console.log("/", address);
  let maxBidInfo;
  let maxBid = 0;
  // let maxBidUser;
  if (transactions[address]) {
    let a = Object.entries(transactions[address]).map(([_, item]) => {
      if (item.amount >= maxBid) {
        maxBidInfo = item;
        maxBid = item.amount;
      }
    });
  }

  res.status(200).send({
    transaction: transactions[address],
    maxBidInfo: maxBidInfo,
  });
});
app.post("/clearAddress", function (request, response) {
  console.log("CLEARING!!!!", request.body); // your JSON
  response.send(request.body); // echo the result back
  transactions[request.body.address] = {};
  console.log("transactions", transactions);
});
app.post("/", function (request, response) {
  console.log("POOOOST!!!!", request.body); // your JSON
  response.send(request.body); // echo the result back
  if (!transactions[request.body.address]) {
    transactions[request.body.address] = {};
  }
  transactions[request.body.address][request.body.bidder] = request.body;
  console.log("transactions", transactions);
});

app.get("/maxbid/:address", function (req, res) {
  const tokenUri = req.params.address;
  console.log("transactions[tokenUri]", transactions[tokenUri]);
  // const id = request.query.id;
  // console.log("vao trong nay tokenUri", tokenUri);
  let maxBid = 0;
  let maxBidUser;
  if (transactions[tokenUri]) {
    let a = Object.entries(transactions[tokenUri]).map(([_, item]) => {
      if (item.amount >= maxBid) {
        maxBid = item.amount;
        maxBidUser = item.bidder;
      }
    });
  }
  console.log("maxBid ", maxBid);
  console.log("maxBidUser ", maxBidUser);
  res.status(200).send({ maxBid: maxBid, maxBidUser: maxBidUser ?? null });
});
// app.get("/reset-secret", function (request, response) {
//   transactions = {};
// });

var server = app.listen(8001, function () {
  console.log("app running on port.", server.address().port);
});
