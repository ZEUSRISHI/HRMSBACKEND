require("dotenv").config();
const connectDB = require("../config/db");
const User      = require("../src/models/User");

const seed = async () => {
  try {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🌱  HRMS SEED STARTED — Admin Login Only");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");  
    await connectDB();

    const adminData = {
      name:       "Admin User",
      email:      "admin@quibotech.com",
      password:   "admin123",
      role:       "admin",
      department: "Management",
      phone:      "9876543210",
      isActive:   true,
    };

    console.log("\n👤  Seeding Admin...");

    const exists = await User.findOne({ email: adminData.email });
    if (exists) {
      exists.password = adminData.password;
      exists.isActive = true;
      await exists.save();
      console.log(`   🔄 Updated  : ${adminData.email} (admin)`);
    } else {
      await User.create(adminData);
      console.log(`   ✅ Created  : ${adminData.email} (admin)`);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉  SEED COMPLETE!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n📋  LOGIN CREDENTIALS:");
    console.log("   Admin  →  admin@quibotech.com  /  admin123  →  select: Admin");
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌  SEED FAILED:", error.message);
    console.error(error);
    process.exit(1);
  }
};

seed();