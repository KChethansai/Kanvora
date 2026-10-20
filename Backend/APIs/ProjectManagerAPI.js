// ProjectManagerAPI routes: Express endpoints for this backend resource.
import exp from "express";
import { verifyRolesToken } from "../middlewares/verifyRolesToken.js";
import { projectModel } from "../models/ProjectModel.js";
import { WorkspaceModel } from "../models/Workspace.js";
import { UserModel } from "../models/usermodel.js";

export const projectApp = exp.Router();

//read own projects
projectApp.get("/project", verifyRolesToken("MANAGER"), async (req, res) => {
  //get logged-in user
  const id = req.user?.id;
  //get user projects
  const projects = await projectModel.find({ creatorId: id });
  //send success response
  res.status(200).json({ message: "Projects", payload: projects });
});

//create project
projectApp.post("/project", verifyRolesToken("MANAGER"), async (req, res) => {
  //get project details
  const projectObj = req.body;
  const workspace = await WorkspaceModel.findById(projectObj.workspace);
  const invalidMembers = [];

  for (const each of projectObj.members) {
    const isMember = workspace.members.some(
      (m) => m.user && m.user.toString() === each.toString(),
    );

    if (!isMember) {
      invalidMembers.push(each);
    }
  }

  if (invalidMembers.length > 0) {
    return res.status(400).json({
      message: "Some members are not part of workspace",
      invalidMembers,
    });
  }
  //store project manager
  const taskObj = new projectModel({ ...projectObj, creatorId: req.user?.id });
  await taskObj.save();
  //send success response
  res.status(201).json({ message: "Project Created Successfully.." });
});

//edit project
projectApp.put("/project", verifyRolesToken("MANAGER"), async (req, res) => {
  //get logged-in user
  const userId = req.user?.id;
  //get project fields
  const { projectId, ...updateFields } = req.body;
  //find project
  const projectObj = await projectModel.findById(projectId);
  //check project exists
  if (!projectObj) {
    return res.status(401).json({ message: "Project not found" });
  }
  //check project manager
  if (userId.toString() != projectObj.creatorId.toString()) {
    return res
      .status(403)
      .json({ message: "You're not allowed to edit this project" });
  }
  //update project
  const updatedProject = await projectModel.findByIdAndUpdate(
    projectId,
    { $set: updateFields },
    { new: true },
  );
  //send success response
  res.status(200).json({
    message: "Successfully edited the project...",
    payload: updatedProject,
  });
});

//soft delete project
projectApp.patch(
  "/project/:id",
  verifyRolesToken("MANAGER"),
  async (req, res) => {
    //get logged-in user
    const userId = req.user?.id;
    //get project status
    const { status } = req.body;
    const projectId = req.params.id;
    //get project details
    const projectObj = await projectModel.findOne({
      _id: projectId,
      creatorId: userId,
    });
    if (!projectObj) {
      return res
        .status(404)
        .json({ message: "Project not found or unauthorized" });
    }
    if (status === projectObj.status) {
      return res.status(200).json({ message: "Project already exist" });
    }
    //save project status
    projectObj.status = status;
    await projectObj.save();
    //send success response
    res
      .status(200)
      .json({
        message: "Project Deleted Successfully...",
        payload: projectObj,
      });
  },
);

//add project member
projectApp.patch(
  "/project",
  verifyRolesToken("MANAGER"),
  async (req, res) => {
    //get logged-in user
    const userId = req.user?.id;
    //get project member fields
    const { projectId, memberId } = req.body;
    //get project details
    const project = await projectModel.findById(projectId);
    //check project manager
    if (userId.toString() != project.creatorId.toString()) {
      return res
        .status(403)
        .json({ message: "You're not allowed to add members" });
    }
    // Check if the member exist in the workspace.

    const workspace = await WorkspaceModel.findById(project.workspace);
    // const updatedMembers=workspace.members.map(each=>{
    //     if(each.includes(membersId)){
    //     return res.status(404).json({message : "Member not exist in the workspace"})
    // }
    // })
    if (!workspace.members.includes(memberId)) {
      const isMemberInWorkspace = workspace.members.some(
        (m) => m.user && m.user.toString() === memberId.toString(),
      );
      if (!isMemberInWorkspace) {
        return res
          .status(404)
          .json({ message: "Member not exist in the workspace" });
      }
      //check existing member
      if (project.members.includes(memberId)) {
        return res
          .status(200)
          .json({ message: "Member already exist in the project" });
      }
      //add member to project
      const updatedProject = await projectModel.findByIdAndUpdate(
        projectId,
        { $push: { members: memberId } },
        { new: true },
      );
      //send success response
      res.status(200).json({
        message: "Successfully added the member",
        payload: updatedProject,
      });
    }
  },
);


