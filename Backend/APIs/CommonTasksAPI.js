// CommonTasksAPI routes: Express endpoints for this backend resource.
import exp from "express";
import { verifyRolesToken } from "../middlewares/verifyRolesToken.js";
import { projectModel } from "../models/ProjectModel.js";
import { taskModel } from "../models/Taskmodel.js";
import { UserModel } from "../models/usermodel.js";

export const commonTaskApp = exp.Router();

//read active tasks
commonTaskApp.get(
  "/task",
  verifyRolesToken("MANAGER", "ADMIN", "MEMBER", "VIEWER"),
  async (req, res) => {
    //get logged-in user
    const userId = req.user?.id;
    //get active tasks
    const tasks = await taskModel.find({ creatorId: userId, isActive: true });
    //send response
    res.status(200).json({ message: "Tasks", payload: tasks });
  },
);

//create task
commonTaskApp.post(
  "/task",
  verifyRolesToken("MANAGER", "ADMIN"),
  async (req, res) => {
    try {
      //get logged-in user
      const userId = req.user?.id;
      //get task fields
      const { projectId, title, description, memberId } = req.body;

      //check project exists
      const projectObj = await projectModel.findById(projectId);
      if (!projectObj) {
        return res.status(404).json({ message: "Project doesn't exist" });
      }

      //check member exists
      const memberObj = await UserModel.findById(memberId);
      if (!memberObj) {
        return res.status(404).json({ message: "Member doesn't exist" });
      }
      //create task
      const newTask = new taskModel({
        title,
        description,
        memberId,
        creatorId: userId,
        projectId,
        status: "TO-DO",
      });
      await newTask.save();
      //send success response
      res.status(201).json({ message: "Successfully created the task" });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Server side error", reason: err.message });
    }
  },
);

//edit task
commonTaskApp.put(
  "/task",
  verifyRolesToken("MANAGER", "ADMIN"),
  async (req, res) => {
    //get logged-in user
    const userId = req.user?.id;
    //get updated task fields
    const { taskId, ...updateFields } = req.body;
    //get task details
    const task = await taskModel.findById(taskId);
    //check task exists
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    //check task owner
    if (userId.toString() != task.creatorId.toString()) {
      return res
        .status(403)
        .json({ message: "You're not allowed to update this task" });
    }
    //update task
    const updatedTask = await taskModel.findByIdAndUpdate(
      taskId,
      { $set: updateFields },
      { new: true },
    );
    //send success response
    res
      .status(200)
      .json({ message: "Task updated successfully...", payload: updatedTask });
  },
);

//soft delete task
commonTaskApp.patch(
  "/task",
  verifyRolesToken("MANAGER", "ADMIN"),
  async (req, res) => {
    //get logged-in user
    const userId = req.user?.id;
    //get task status
    const { taskId, status } = req.body;
    //get task details
    const task = await taskModel.findById(taskId);
    //check task exists
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    //check task owner
    if (userId.toString() != task.creatorId.toString()) {
      return res
        .status(403)
        .json({ message: "You're not allowed to delete the task" });
    }
    //check current status
    if (task.isActive === status) {
      return res
        .status(200)
        .json({ message: "Task is already in the same status" });
    }
    //save task status
    task.isActive = status;
    await task.save();
    //send success response
    res
      .status(200)
      .json({ message: "Successfully deleted the task", payload: task });
  },
);


