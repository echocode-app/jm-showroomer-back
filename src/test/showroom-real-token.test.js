import request from "supertest";
import { expect } from "chai";
import app from "../core/app.js";

const DEV_BASE_URL = "/api/v1";

// ID Token OWNER / ADMIN
const ownerToken = "YOUR_REAL_OWNER_ID_TOKEN";
const adminToken = "YOUR_REAL_ADMIN_ID_TOKEN";
const userToken = "YOUR_REAL_USER_ID_TOKEN";

let createdShowroomId;

describe("Showroom CRUD with Real Token", function () {
  this.timeout(10000);

  it("should create a new showroom as OWNER", async () => {
    const res = await request(app)
      .post(`${DEV_BASE_URL}/showrooms/create`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: `Test Showroom ${Date.now()}`,
        type: "Мультибренд шоурум",
        availability: "вільний доступ",
        address: "Kyiv, Ukraine",
        country: "Ukraine",
        city: "Kyiv",
        contacts: {
          phone: "+380999999999",
          instagram: "https://instagram.com/testshowroom"
        },
        location: { lat: 50.45, lng: 30.523 }
      });

    expect(res.status).to.equal(200);
    expect(res.body.success).to.be.true;
    expect(res.body.data.showroom).to.have.property("id");

    createdShowroomId = res.body.data.showroom.id;
  });

  it("should list showrooms publicly", async () => {
    const res = await request(app).get(`${DEV_BASE_URL}/showrooms`);
    expect(res.status).to.equal(200);
    expect(res.body.success).to.be.true;
    expect(res.body.data.showrooms).to.be.an("array");
  });

  it("should get showroom by ID for OWNER", async () => {
    const res = await request(app)
      .get(`${DEV_BASE_URL}/showrooms/${createdShowroomId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.be.true;
    expect(res.body.data.showroom).to.have.property("name");
  });

  it("should update showroom as OWNER", async () => {
    const res = await request(app)
      .patch(`${DEV_BASE_URL}/showrooms/${createdShowroomId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Updated Showroom Name" });

    expect(res.status).to.equal(200);
    expect(res.body.success).to.be.true;
    expect(res.body.data.showroom.name).to.equal("Updated Showroom Name");
    expect(res.body.data.showroom.editCount).to.equal(1);
    expect(res.body.data.showroom.editHistory).to.be.an("array");
  });

  it("should not allow showroom creation in blocked country", async () => {
    const res = await request(app)
      .post(`${DEV_BASE_URL}/showrooms/create`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: `Blocked Showroom ${Date.now()}`,
        type: "Мультибренд шоурум",
        availability: "вільний доступ",
        address: "Somewhere",
        country: "Russia"
      });

    expect(res.status).to.equal(400);
    expect(res.body.success).to.be.false;
    expect(res.body.error.code).to.equal("COUNTRY_BLOCKED");
  });

  it("should forbid regular USER from creating showroom", async () => {
    const res = await request(app)
      .post(`${DEV_BASE_URL}/showrooms/create`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        name: `User Showroom ${Date.now()}`,
        type: "Мультибренд шоурум",
        availability: "вільний доступ",
        address: "Kyiv, Ukraine",
        country: "Ukraine"
      });

    expect(res.status).to.equal(403);
    expect(res.body.success).to.be.false;
  });
});
