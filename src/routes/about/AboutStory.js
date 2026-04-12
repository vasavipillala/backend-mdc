const express = require("express");
const router = express.Router();
const { UserStory,Experience,Education,UserLink} = require("../../../db");
const authenticate = require("../../middleware/auth/Authentication");


const sendSuccess = (res, data, message = "Success") => {
  return res.status(200).json({
    status: true,
    message,
    data,
  });
};

const sendError = (res, error, message = "Something went wrong") => {
  return res.status(500).json({
    status: false,
    message,
    error: error?.message || error,
  });
};

router.post("/story", async (req, res) => {
  try {
    const { userId, story } = req.body;

    let data = await UserStory.findOne({ where: { userId } });

    if (data) {
      await data.update({ story });
    } else {
      data = await UserStory.create({ userId, story });
    }

    return sendSuccess(res, data, "Story saved successfully");

  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/story/:userId", async (req, res) => {
  try {
    const story = await UserStory.findOne({
      where: { userId: req.params.userId },
    });

    return sendSuccess(
      res,
      story,
      story ? "Story fetched successfully" : "No story found"
    );

  } catch (error) {
    return sendError(res, error);
  }
});

// DELETE STORY
router.delete("/story/:userId", async (req, res) => {
  try {
    await UserStory.destroy({
      where: { userId: req.params.userId },
    });

    return sendSuccess(res, null, "Story deleted successfully");

  } catch (error) {
    return sendError(res, error);
  }
});

router.post("/experience", authenticate, async (req, res) => {
  try {
    const experience = await Experience.create({
      ...req.body,
      userId: req.user.id,
    });

    return sendSuccess(res, experience, "Experience created successfully");

  } catch (error) {
    return sendError(res, error);
  }
});



router.get("/experience/:userId", async (req, res) => {
  try {
    const data = await Experience.findAll({
      where: { userId: req.params.userId },
      order: [["createdAt", "DESC"]],
    });

    return sendSuccess(
      res,
      data,
      data.length ? "Experience fetched successfully" : "No experience found"
    );

  } catch (error) {
    return sendError(res, error);
  }
});


router.put("/experience/:id", authenticate, async (req, res) => {
  try {
    const exp = await Experience.findByPk(req.params.id);

    if (!exp) {
      return res.status(404).json({
        status: false,
        message: "Experience not found",
      });
    }

    await exp.update(req.body);

    return sendSuccess(res, exp, "Experience updated successfully");

  } catch (error) {
    return sendError(res, error);
  }
});
router.delete("/experience/:id", authenticate, async (req, res) => {
  try {
    await Experience.destroy({ where: { id: req.params.id } });

    return sendSuccess(res, null, "Experience deleted successfully");

  } catch (error) {
    return sendError(res, error);
  }
});

router.post("/education", authenticate, async (req, res) => {
  try {
    const education = await Education.create({
      ...req.body,
      userId: req.user.id,
    });

    return sendSuccess(res, education, "Education created successfully");

  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/education/:userId", async (req, res) => {
  try {
    const data = await Education.findAll({
      where: { userId: req.params.userId },
    });

    return sendSuccess(
      res,
      data,
      data.length ? "Education fetched successfully" : "No education found"
    );

  } catch (error) {
    return sendError(res, error);
  }
});

router.put("/education/:id", authenticate, async (req, res) => {
  try {
    const edu = await Education.findByPk(req.params.id);

    if (!edu) {
      return res.status(404).json({
        status: false,
        message: "Education not found",
      });
    }

    await edu.update(req.body);

    return sendSuccess(res, edu, "Education updated successfully");

  } catch (error) {
    return sendError(res, error);
  }
});

router.delete("/education/:id", authenticate, async (req, res) => {
  try {
    await Education.destroy({
      where: { id: req.params.id },
    });

    return sendSuccess(res, null, "Education deleted successfully");

  } catch (error) {
    return sendError(res, error);
  }
});

router.post("/link", authenticate, async (req, res) => {
  try {
    const link = await UserLink.create({
      ...req.body,
      userId: req.user.id,
    });

    return sendSuccess(res, link, "Link created successfully");

  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/link/:userId", async (req, res) => {
  try {
    const links = await UserLink.findAll({
      where: { userId: req.params.userId },
    });

    return sendSuccess(
      res,
      links,
      links.length ? "Links fetched successfully" : "No links found"
    );

  } catch (error) {
    return sendError(res, error);
  }
});

router.put("/link/:id", authenticate, async (req, res) => {
  try {
    const link = await UserLink.findByPk(req.params.id);

    if (!link) {
      return res.status(404).json({
        status: false,
        message: "Link not found",
      });
    }

    await link.update(req.body);

    return sendSuccess(res, link, "Link updated successfully");

  } catch (error) {
    return sendError(res, error);
  }
});

router.delete("/link/:id", authenticate, async (req, res) => {
  try {
    await UserLink.destroy({
      where: { id: req.params.id },
    });

    return sendSuccess(res, null, "Link deleted successfully");

  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;