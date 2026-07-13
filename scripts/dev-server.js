process.env.SELF_TEST_AUTORUN = process.env.SELF_TEST_AUTORUN || "false";
process.env.PORT = process.env.PORT || "4173";

require("../server");
