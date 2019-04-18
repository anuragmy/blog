const mongoose = require("mongoose");
const redis = require("redis");
const redisUrl = "redis://127.0.0.1:6379";
const client = redis.createClient(redisUrl);
const util = require("util");

client.hget = util.promisify(client.hget);

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function(options = {}) {
  this.isCached = true;
  this.hashKey = JSON.stringify(options.key || "");
  return this;
};
mongoose.Query.prototype.exec = async function() {
  if (!this.isCached) return exec.apply(this, arguments);
  console.log("im about to run a run a query");
  //   console.log(this.getQuery());
  //   console.log(this.mongooseCollection.name);

  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name
    })
  );

  console.log(key);

  //check the 'key' in redis
  const cachedValue = await client.hget(this.hashKey, key);

  // //if found, return that
  if (cachedValue) {
    console.log("this is from redis");
    const doc = JSON.parse(cachedValue);

    return Array.isArray(doc)
      ? doc.map(d => new this.model(d))
      : new this.model(doc);
  }
  //   //converting into model
  //   const doc = JSON.parse(cachedValue);
  //   return Array.isArray(doc)
  //     ? doc.map(d => new this.model(d))
  //     : new this.model(doc);
  // }

  //otherwise, store the result in redis
  const result = await exec.apply(this, arguments);
  console.log(result);
  console.log("this is from mongo");
  client.hset(this.hashKey, key, JSON.stringify(result), "EX", 10);

  return result;
};

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  }
};
