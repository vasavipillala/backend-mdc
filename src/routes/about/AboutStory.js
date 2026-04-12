const express = require("express");
const router = express.Router();
const { UserStory,Experience} = require("../../../db");
const authenticate = require("../../middleware/auth/Authentication");
const Education = require("../../models/abouts/Education");
const UserLink = require("../../models/abouts/UserLink");


// CREATE / UPDATE STORY
router.post("/story", async (req, res) => {
  try {
    const { userId, story } = req.body;

    let data = await UserStory.findOne({
      where: { userId },
    });

    if (data) {
      await data.update({ story });
    } else {
      data = await UserStory.create({ userId, story });
    }

    res.json({
      status: "success",
      data,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/story/:userId", async (req, res) => {
  try {
    const story = await UserStory.findOne({
      where: { userId: req.params.userId },
    });

    res.json(story);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE STORY
router.delete("/story/:userId", async (req, res) => {
  try {
    await UserStory.destroy({
      where: { userId: req.params.userId },
    });

    res.json({ message: "Story deleted" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.post("/experience", authenticate, async (req, res) => {
  const experience = await Experience.create({
    ...req.body,
    userId: req.user.id,
  });

  res.json(experience);
});

router.get("/experience/:userId", async (req, res) => {
  const data = await Experience.findAll({
    where: { userId: req.params.userId },
    order: [["createdAt", "DESC"]],
  });

  res.json(data);
}); 

router.put("/experience/:id", authenticate, async (req, res) => {
  const exp = await Experience.findByPk(req.params.id);

  if (!exp) return res.status(404).json({ message: "Not found" });

  await exp.update(req.body);

  res.json(exp);
});

router.delete("/experience/:id", authenticate, async (req, res) => {
  await Experience.destroy({
    where: { id: req.params.id },
  });

  res.json({ message: "Experience deleted" });
});

router.post("/education", authenticate, async (req, res) => {
  const education = await Education.create({
    ...req.body,
    userId: req.user.id,
  });

  res.json(education);
});

router.get("/education/:userId", async (req, res) => {
  const data = await Education.findAll({
    where: { userId: req.params.userId },
  });

  res.json(data);
});

router.put("/education/:id", authenticate, async (req, res) => {
  const edu = await Education.findByPk(req.params.id);
  await edu.update(req.body);

  res.json(edu);
});

router.delete("/education/:id", authenticate, async (req, res) => {
  await Education.destroy({
    where: { id: req.params.id },
  });

  res.json({ message: "Education deleted" });
});

router.post("/link", authenticate, async (req, res) => {
  const link = await UserLink.create({
    ...req.body,
    userId: req.user.id,
  });

  res.json(link);
});

router.get("/link/:userId", async (req, res) => {
  const links = await UserLink.findAll({
    where: { userId: req.params.userId },
  });

  res.json(links);
});

router.put("/link/:id", authenticate, async (req, res) => {
  const link = await UserLink.findByPk(req.params.id);
  await link.update(req.body);

  res.json(link);
});

router.delete("/link/:id", authenticate, async (req, res) => {
  await UserLink.destroy({
    where: { id: req.params.id },
  });

  res.json({ message: "Link deleted" });
});

module.exports = router;