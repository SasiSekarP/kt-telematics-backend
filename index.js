const express = require("express");
const app = express();
const PORT = process.env.PORT || 4000;
const { MongoClient } = require("mongodb");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

app.use(
  cors({
    origin: "http://localhost:3000",
  })
);

app.use(express.json());

const url = "mongodb://127.0.0.1:27017";

const dbName = "kt_telematics";

const dataBaseConnection = async () => {
  try {
    const client = await MongoClient.connect(url);
    console.log("db connection success");

    const db = client.db(dbName);

    const employeeDetails = db.collection("employeeDetails");

    const assetCollection = db.collection("assetCollection");

    const categoryCollection = db.collection("categoryCollection");

    async function getCategoryList() {
      const response = await categoryCollection
        .find({}, { category: 0 })
        .toArray();
      const data = response.map((data) => {
        return data.category;
      });
      return data;
    }

    // add new employee
    app.post("/add-new-employee", (req, res) => {
      const { employeeName, posting, status } = req.body;
      employeeDetails.insertOne({
        _id: uuidv4(),
        employeeName,
        posting,
        status,
        asset_holdings: [],
      });
      res.send({ status: "success" });
    });

    // employee List
    app.get("/employee-list", async (req, res) => {
      const { status, employeeName } = req.query;
      if (status === "" && employeeName === "") {
        const employeeList = await employeeDetails.find({}).toArray();
        res.json(employeeList);
      } else if (status !== "" && employeeName === "") {
        const employeeList = await employeeDetails.find({ status }).toArray();
        res.json(employeeList);
      } else if (status === "" && employeeName !== "") {
        const regex = new RegExp(employeeName, "i");
        const employeeList = await employeeDetails
          .find({ employeeName: { $regex: regex } })
          .toArray();
        res.json(employeeList);
      } else {
        const regex = new RegExp(deviceName, "i");
        const employeeList = await employeeDetails
          .find({ status, employeeName: { $regex: regex } })
          .toArray();
        res.json(employeeList);
      }
    });

    // edit employee details
    app.put("/edit-employee", async (req, res) => {
      const { employeeName, posting, status, _id } = req.body;
      await employeeDetails.updateOne(
        { _id },
        { $set: { employeeName, posting, status } }
      );
      res.json({ status: "success" });
    });

    // edit employee details
    app.delete("/delete-employee", async (req, res) => {
      const { _id } = req.query;
      const employeeData = await employeeDetails.findOne({ _id });
      if (employeeData.asset_holdings.length === 0) {
        await employeeDetails.deleteOne({ _id });
        res.json({ status: "success" });
      } else if (employeeData.asset_holdings.length > 0) {
        res.json({
          status: "failed",
          message:
            "This employee is holding some assets get all the assets back to delete this employee",
        });
      }
    });

    // add new asset
    app.post("/add-new-asset", async (req, res) => {
      const { deviceName, category } = req.body;
      await assetCollection.insertOne({
        deviceName,
        category,
        _id: uuidv4(),
        history: [],
        current_user: "No one",
        status: "Available",
      });

      const categoryData = await categoryCollection.findOne({ category });

      const categoryCount = await categoryData.available;

      await categoryCollection.updateOne(
        { category },
        {
          $set: { available: categoryCount + 1 },
        }
      );

      res.json({ status: "success" });
    });

    // asset list sending
    app.get("/asset-list", async (req, res) => {
      const { category, deviceName } = req.query;
      const categoryList = await getCategoryList();
      if (category === "" && deviceName === "") {
        const assetList = await assetCollection
          .find({ status: { $ne: "Scrap" } })
          .toArray();

        res.json({ assetList, categoryList });
      } else if (category !== "" && deviceName === "") {
        const assetList = await assetCollection
          .find({ category, status: { $ne: "Scrap" } })
          .toArray();
        res.json({ assetList, categoryList });
      } else if (category === "" && deviceName !== "") {
        const regex = new RegExp(deviceName, "i");
        arrData = await assetCollection
          .find({ deviceName: { $regex: regex } })
          .toArray();
        res.json({
          assetList: arrData,
          categoryList,
          status: { $ne: "Scrap" },
        });
      } else {
        const regex = new RegExp(deviceName, "i");
        arrData = await assetCollection
          .find({ category, deviceName: { $regex: regex } })
          .toArray();
        res.json({
          assetList: arrData,
          categoryList,
          status: { $ne: "Scrap" },
        });
      }
    });

    // deleting an asset
    app.delete("/asset-delete", async (req, res) => {
      const { _id, category } = req.query;

      const assetData = await assetCollection.findOne({ _id });
      const status = await assetData.status;
      if (status === "Available" || status === "Scrap") {
        await assetCollection.deleteOne({ _id });

        const categoryData = await categoryCollection.findOne({ category });

        const availableCount = await categoryData.available;
        const scrapCount = await categoryData.scrap;

        if (status === "Available") {
          await categoryCollection.updateOne(
            { category },
            {
              $set: { available: availableCount - 1 },
            }
          );
        } else {
          await categoryCollection.updateOne(
            { category },
            {
              $set: { scrap: scrapCount - 1 },
            }
          );
        }
        res.json({ status: "success" });
      } else if (status === "Issued") {
        res.json({
          status: "failed",
          message: "Asset is issued. Get it back to delete it",
        });
      } else {
        res.json({
          status: "failed",
          message: "Something went wrong. Please try after sometimes",
        });
      }
    });

    // moving asset inbetween available and scrap
    app.put("/switch-status", async (req, res) => {
      const { _id, to_location } = req.query;

      const data = await assetCollection.findOne({ _id });

      if (data.status !== "Issued") {
        const category = await data.category;
        const categoryCountDetails = await categoryCollection.findOne({
          category,
        });
        const categoryAvailableCount = await categoryCountDetails.available;
        const categoryScrapCount = await categoryCountDetails.scrap;
        if (to_location === "Available") {
          await categoryCollection.updateOne(
            { category },
            {
              $set: {
                available: categoryAvailableCount + 1,
                scrap: categoryScrapCount - 1,
              },
            }
          );
        } else {
          await categoryCollection.updateOne(
            { category },
            {
              $set: {
                available: categoryAvailableCount - 1,
                scrap: categoryScrapCount + 1,
              },
            }
          );
        }
        await assetCollection.updateOne(
          { _id },
          { $set: { status: to_location } }
        );
        res.json({ status: "success" });
      } else {
        res.json({
          status: "failed",
          message:
            "This item is issued to an employee. Get it back to move scrap",
        });
      }
    });

    // edit asset details
    app.put("/edit-asset", async (req, res) => {
      const { _id, category, deviceName } = req.body;
      await assetCollection.updateOne(
        { _id },
        { $set: { category, deviceName } }
      );
      res.json({ status: "success" });
    });

    // available assets to issue and available assets to remove
    app.get("/available-assets", async (req, res) => {
      const { status, deviceName, category } = req.query;
      const categoryList = await getCategoryList();

      if (deviceName === "" && category === "") {
        const availabileAssets = await assetCollection
          .find({
            status,
          })
          .toArray();
        res.json({ availabileAssets, categoryList });
      } else if (deviceName === "" && category !== "") {
        const availabileAssets = await assetCollection
          .find({
            status,
            category,
          })
          .toArray();
        res.json({ availabileAssets, categoryList });
      } else if (deviceName !== "" && category === "") {
        const regex = new RegExp(deviceName, "i");
        const availabileAssets = await assetCollection
          .find({
            status,
            deviceName: { $regex: regex },
          })
          .toArray();
        res.json({ availabileAssets, categoryList });
      } else {
        const regex = new RegExp(deviceName, "i");
        const availabileAssets = await assetCollection
          .find({
            status,
            category,
            deviceName: { $regex: regex },
          })
          .toArray();
        res.json({ availabileAssets, categoryList });
      }
    });

    // issue-asset
    app.put("/issue-asset", async (req, res) => {
      const { current_user_id, asset_id } = req.query;
      const current_user_raw_data = await employeeDetails.findOne({
        _id: current_user_id,
      });
      const current_user_data = await {
        employeeName: current_user_raw_data.employeeName,
        _id: current_user_raw_data._id,
        reason_for_return: "",
      };
      const asset_raw_data = await assetCollection.findOne({ _id: asset_id });
      const asset_data = await {
        _id: asset_raw_data._id,
        deviceName: asset_raw_data.deviceName,
        category: asset_raw_data.category,
      };
      const categoryData = await categoryCollection.findOne({
        category: asset_data.category,
      });
      const categoryAvailableCount = await categoryData.available;
      const categoryIssuedCount = await categoryData.issued;
      await assetCollection.updateOne(
        { _id: asset_id },
        {
          $set: { status: "Issued", current_user: current_user_data },
          $push: { history: current_user_data },
        }
      );
      await categoryCollection.updateOne(
        { category: asset_data.category },
        {
          $set: {
            available: categoryAvailableCount - 1,
            issued: categoryIssuedCount + 1,
          },
        }
      );
      await employeeDetails.updateOne(
        { _id: current_user_id },
        { $push: { asset_holdings: asset_data } }
      );
      res.json({ status: "success" });
    });

    // single asset details to return asset
    app.get("/asset-details-for-returning-it", async (req, res) => {
      const { _id } = req.query;
      const assetData = await assetCollection.findOne({ _id });

      res.json({
        deviceName: assetData.deviceName,
        category: assetData.category,
        asset_id: assetData._id,
        employeeName: assetData.current_user.employeeName,
        employeeId: assetData.current_user._id,
      });
    });

    // return asset
    app.put("/return-asset", async (req, res) => {
      const { asset_id, employeeId, category } = req.query;
      const { reason } = req.body;
      const assetData = await assetCollection.findOne({ _id: asset_id });
      const current_user = await assetData.current_user;
      const current_user2 = { ...current_user, reason_for_return: reason };
      await assetCollection.updateOne(
        { _id: asset_id },
        {
          $set: { current_user: "No one", status: "Available" },
          $pull: { history: { _id: employeeId } },
        }
      );
      await assetCollection.updateOne(
        { _id: asset_id },
        {
          $push: { history: current_user2 },
        }
      );

      const categoryData = await categoryCollection.findOne({
        category,
      });
      const categoryAvailableCount = await categoryData.available;
      const categoryIssuedCount = await categoryData.issued;

      await categoryCollection.updateOne(
        { category },
        {
          $set: {
            available: categoryAvailableCount + 1,
            issued: categoryIssuedCount - 1,
          },
        }
      );

      await employeeDetails.updateOne(
        { _id: employeeId },
        {
          $pull: { asset_holdings: { _id: asset_id } },
        }
      );

      res.json({ status: "success" });
    });

    // single asset history
    app.get("/single-asset-data", async (req, res) => {
      const { _id } = req.query;
      const assetData = await assetCollection.findOne({ _id });
      res.json(assetData);
    });

    //   add new category
    app.post("/add-new-category", async (req, res) => {
      const { category } = req.body;

      const availability = await categoryCollection.findOne({ category });

      if (availability) {
        res.json({ status: "failed" });
      } else {
        categoryCollection.insertOne({
          category,
          _id: uuidv4(),
          available: 0,
          issued: 0,
          scrap: 0,
        });
        res.json({ status: "success" });
      }
    });

    // category delete
    app.delete("/category-delete", async (req, res) => {
      const { _id, category } = req.query;
      const isDeletePossible = await assetCollection.findOne({ category });
      if (!isDeletePossible) {
        categoryCollection.deleteOne({ _id });
        res.json({ status: "success" });
      } else {
        res.json({
          status: "failed",
          message:
            "Some items have this name as category. delete those things to delete this category name",
        });
      }
    });

    // category update
    app.put("/category-update/:_id", async (req, res) => {
      const { _id } = req.params;
      const { category, oldCategory } = req.body;
      await categoryCollection.updateMany({ _id }, { $set: { category } });
      await assetCollection.updateMany(
        { category: oldCategory },
        { $set: { category } }
      );
      res.json({ status: "success" });
    });

    // category list for select drop down
    app.get("/get-category-list", async (req, res) => {
      const data = await getCategoryList();
      res.json(data);
    });

    // stock view with quary params
    app.get("/stock-view", async (req, res) => {
      const { category } = req.query;
      let arrData = [];
      if (category) {
        const regex = new RegExp(category, "i");
        arrData = await categoryCollection
          .find({ category: { $regex: regex } })
          .toArray();
      } else {
        arrData = await categoryCollection.find({}).toArray();
      }

      res.json(arrData);
    });

    // scrap list sending
    app.get("/scrap-asset", async (req, res) => {
      const { category, deviceName } = req.query;

      const categoryList = await getCategoryList();
      if (category === "" && deviceName === "") {
        const scrapAssetList = await assetCollection
          .find({ status: "Scrap" })
          .toArray();

        res.json({ scrapAssetList, categoryList });
      } else if (category !== "" && deviceName === "") {
        const scrapAssetList = await assetCollection
          .find({ category, status: "Scrap" })
          .toArray();
        res.json({ scrapAssetList, categoryList });
      } else if (category === "" && deviceName !== "") {
        const regex = new RegExp(deviceName, "i");
        const scrapAssetList = await assetCollection
          .find({ deviceName: { $regex: regex } })
          .toArray();
        res.json({
          scrapAssetList,
          categoryList,
          status: { $ne: "Scrap" },
        });
      } else {
        const regex = new RegExp(deviceName, "i");
        const scrapAssetList = await assetCollection
          .find({ category, deviceName: { $regex: regex } })
          .toArray();
        res.json({
          scrapAssetList,
          categoryList,
          status: { $ne: "Scrap" },
        });
      }
    });

    app.listen(PORT, () => {
      console.log(`port is listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Error connecting to the MongoDB server:", err);
  }
};

dataBaseConnection();
