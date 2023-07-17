const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Started");
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};

initializeDbAndServer();

// API- 1//
app.post("/register/", async (request, response) => {
  const newUserDetails = request.body;
  const { username, password, name, gender } = newUserDetails;
  const isPresentQuery = `SELECT * FROM user
  WHERE username = "${username}";`;
  const userDetail = await db.get(isPresentQuery);
  if (userDetail !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else if (password.length < 6) {
    response.status(400);
    response.send("Password is too short");
  } else if (userDetail === undefined) {
    const encryptPwd = await bcrypt.hash(password, 10);
    const createUserQuery = `INSERT INTO user(name, username, password, gender)
      VALUES("${name}","${username}","${encryptPwd}","${gender}" );`;
    await db.run(createUserQuery);
    response.send("User created successfully");
  }
});

///API-2///

app.post("/login/", async (request, response) => {
  let jwtToken;
  const loginDetails = request.body;
  const { username, password } = loginDetails;
  const isPresentQuery = `SELECT * FROM user
  WHERE username = "${username}";`;
  const userDetail = await db.get(isPresentQuery);
  if (userDetail === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isCorrect = await bcrypt.compare(password, userDetail.password);
    if (isCorrect === true) {
      jwtToken = jwt.sign(username, "secret_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

///MiddlewareFunction///

const authentication = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    await jwt.verify(jwtToken, "secret_key", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        console.log(payload);
        request.username = payload;
        next();
      }
    });
  }
};

///API-3///
app.get("/user/tweets/feed/", authentication, async (request, response) => {
  const { username } = request;
  const loggerQuery = `SELECT * FROM user
  WHERE username = "${username}";`;
  const loggerDetails = await db.get(loggerQuery);
  const { user_id } = loggerDetails;

  const feedQuery = `SELECT username, tweet, date_time as dateTime FROM tweet 
    INNER JOIN follower on tweet.user_id = following_user_id
    INNER JOIN user on user.user_id = tweet.user_id
    WHERE follower_user_id = ${user_id}
    ORDER BY date_time DESC
    LIMIT 4;`;
  const feedData = await db.all(feedQuery);
  response.send(feedData);
});

///API-4///
app.get("/user/following/", authentication, async (request, response) => {
  const { username } = request;
  const loggerQuery = `SELECT * FROM user
  WHERE username = "${username}";`;
  const loggerDetails = await db.get(loggerQuery);
  const { user_id } = loggerDetails;

  const followerQuery = `SELECT name as name FROM user INNER JOIN follower on user.user_id = following_user_id
  WHERE follower.follower_user_id = ${user_id};`;
  const followerData = await db.all(followerQuery);
  response.send(followerData);
});

///API-5///
app.get("/user/followers/", authentication, async (request, response) => {
  const { username } = request;
  const loggerQuery = `SELECT * FROM user
  WHERE username = "${username}";`;
  const loggerDetails = await db.get(loggerQuery);
  const { user_id } = loggerDetails;

  const followerQuery = `SELECT name as name FROM user INNER JOIN follower on user.user_id = follower_user_id
WHERE follower.following_user_id = ${user_id};`;
  const followerData = await db.all(followerQuery);
  response.send(followerData);
});

///API-6///

app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const loggerQuery = `SELECT * FROM user
  WHERE username = "${username}";`;
  const loggerDetails = await db.get(loggerQuery);
  const { user_id } = loggerDetails;

  const idCheckingQuery = `SELECT * FROM tweet INNER JOIN
  follower ON following_user_id = tweet.user_id
  WHERE follower_user_id = ${user_id} AND tweet_id = ${tweetId};`;
  const data = await db.all(idCheckingQuery);
  if (data.length === 0) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const tweetDataQuery = `SELECT tweet, COUNT(like_id) as likes,COUNT(reply_id) as replies,
      date_time as dateTime FROM tweet INNER JOIN reply
      ON reply.tweet_id = ${tweetId} INNER JOIN like ON like.tweet_id = ${tweetId};`;
    const tweetData = await db.get(tweetDataQuery);
    response.send(tweetData);
  }
});

///API-7///
app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const loggerQuery = `SELECT * FROM user
  WHERE username = "${username}";`;
    const loggerDetails = await db.get(loggerQuery);
    const { user_id } = loggerDetails;

    const idCheckingQuery = `SELECT * FROM tweet INNER JOIN
  follower ON following_user_id = tweet.user_id
  WHERE follower_user_id = ${user_id} AND tweet_id = ${tweetId};`;
    const data = await db.all(idCheckingQuery);
    if (data.length === 0) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const likedQuery = `SELECT username FROM user INNER JOIN
        like ON user.user_id = like.user_id
        INNER JOIN tweet ON tweet.tweet_id = like.tweet_id
        WHERE tweet.tweet_id = ${tweetId};`;
      const likedData = await db.all(likedQuery);
      const array = likedData.map((each) => {
        return each.username;
      });
      const likes = { likes: array };
      response.send(likes);
    }
  }
);
///API-8///
app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const loggerQuery = `SELECT * FROM user
  WHERE username = "${username}";`;
    const loggerDetails = await db.get(loggerQuery);
    const { user_id } = loggerDetails;
    const idCheckingQuery = `SELECT * FROM tweet INNER JOIN
  follower ON following_user_id = tweet.user_id
  WHERE follower_user_id = ${user_id} AND tweet_id = ${tweetId};`;
    const data = await db.all(idCheckingQuery);

    if (data.length === 0) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const replyQuery = `SELECT name, reply FROM user INNER JOIN
        reply ON user.user_id = reply.user_id
        INNER JOIN tweet ON tweet.tweet_id = reply.tweet_id
        WHERE tweet.tweet_id = ${tweetId};`;
      const replyData = await db.all(replyQuery);
      const replyObj = { replies: replyData };
      response.send(replyObj);
    }
  }
);

///API-9///
app.get("/user/tweets/", authentication, async (request, response) => {
  const { username } = request;
  const loggerQuery = `SELECT * FROM user
  WHERE username = "${username}";`;
  const loggerDetails = await db.get(loggerQuery);
  const { user_id } = loggerDetails;

  const tweetDataQuery = `SELECT tweet, count(like_id) as likes, count(reply) as replies,
  tweet.date_time as dateTime FROM tweet INNER JOIN user ON
   user.user_id = tweet.user_id INNER JOIN reply ON
  tweet.tweet_id = reply.tweet_id INNER JOIN like ON 
 tweet.tweet_id = like.tweet_id
  WHERE tweet.user_id = ${user_id};`;
  const tweetData = await db.all(tweetDataQuery);
  response.send(tweetData);
});

///API-10///
app.post("/user/tweets/", authentication, async (request, response) => {
  const { tweet } = request.body;
  const newTweetQuery = `INSERT INTO tweet(tweet)
    VALUES("${tweet}");`;
  await db.run(newTweetQuery);
  response.send("Created a Tweet");
});

///API-11///
app.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const loggerQuery = `SELECT * FROM user
  WHERE username = "${username}";`;
  const loggerDetails = await db.get(loggerQuery);
  const { user_id } = loggerDetails;

  const myTweetQuery = `SELECT username FROM tweet INNER JOIN user
  ON user.user_id = tweet.user_id
  WHERE user.user_id = ${user_id} AND tweet.tweet_id = ${tweetId};`;
  const myTweet = await db.get(myTweetQuery);
  if (myTweet === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const deleteTweetQuery = `DELETE FROM tweet
      WHERE tweet_id = ${tweetId};`;
    await db.run(deleteTweetQuery);
    response.send("Tweet Removed");
  }
});

module.exports = app;
