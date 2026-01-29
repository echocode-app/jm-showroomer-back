import request from "supertest";
import { expect } from "chai";
import app from "../core/app.js";

let createdShowroomId;

// mock tokens for different user roles
const ownerToken = "OWNER_TEST_TOKEN";
const adminToken = "ADMIN_TEST_TOKEN";
const userToken = "USER_TEST_TOKEN";

describe("Showroom CRUD", function () {
  this.timeout(5000);

  // CREATE SHOWROOM
  it("should create a new showroom as OWNER", async () => {
    const res = await request(app)
      .post("/api/v1/showrooms/create")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Test Showroom",
        type: "Мультибренд шоурум",
        availability: "вільний доступ",
        address: "Kyiv, Ukraine",
        country: "Ukraine",
        contacts: {
          phone: "+380999999999",
          instagram: "https://instagram.com/testshowroom"
        },
        location: { lat: 50.45, lng: 30.523 }
      });

    expect(res.status).to.equal(200);
    expect(res.body.success).to.be.true;
    expect(res.body.data).to.have.property("id");

    createdShowroomId = res.body.data.id; // store for later tests
  });

  // LIST SHOWROOMS
  it("should list showrooms publicly", async () => {
    const res = await request(app).get("/api/v1/showrooms");
    expect(res.status).to.equal(200);
    expect(res.body.success).to.be.true;
    expect(res.body.data).to.be.an("array");
  });

  // GET SHOWROOM BY ID
  it("should get showroom by ID for owner", async () => {
    const res = await request(app)
      .get(`/api/v1/showrooms/${createdShowroomId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.data).to.have.property("name", "Test Showroom");
  });

  // UPDATE SHOWROOM
  it("should update showroom as OWNER", async () => {
    const res = await request(app)
      .patch(`/api/v1/showrooms/${createdShowroomId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Updated Showroom Name" });

    expect(res.status).to.equal(200);
    expect(res.body.data.name).to.equal("Updated Showroom Name");
    expect(res.body.data.editCount).to.equal(1);
    expect(res.body.data.editHistory).to.be.an("array");
  });

  // BLOCKED COUNTRY TEST
  it("should not allow showroom creation in blocked country", async () => {
    const res = await request(app)
      .post("/api/v1/showrooms/create")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Blocked Country Showroom",
        type: "Мультибренд шоурум",
        availability: "вільний доступ",
        address: "Somewhere",
        country: "Russia"
      });

    expect(res.status).to.equal(400);
    expect(res.body.success).to.be.false;
    expect(res.body.error.code).to.equal("COUNTRY_BLOCKED");
  });
});
