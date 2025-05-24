const taskService = require('../services/taskService');

exports.getAllTasks = async (req, res, next) => {
  try {
    const { page, limit, completed, sortBy, tags, tagMatchMode } = req.query; // Add 'tagMatchMode' here
    const options = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      completed: completed,
      sortBy: sortBy,
      tags: tags,
      tagMatchMode: tagMatchMode, // Ensure 'tagMatchMode' from query is passed to options
    };

    const result = await taskService.getAllTasks(req.user.id, options);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getTaskById = async (req, res, next) => {
  try {
    const task = await taskService.getTaskById(req.params.id, req.user.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found or not owned by user' });
    }
    res.status(200).json(task);
  } catch (error) {
    next(error);
  }
};

exports.createTask = async (req, res, next) => {
  try {
    const newTask = await taskService.createTask(req.body, req.user.id);
    res.status(201).json(newTask);
  } catch (error) {
    next(error);
  }
};

exports.updateTask = async (req, res, next) => {
  try {
    const updatedTask = await taskService.updateTask(req.params.id, req.body, req.user.id);
    if (!updatedTask) {
      return res.status(404).json({ message: 'Task not found or not owned by user' });
    }
    res.status(200).json(updatedTask);
  } catch (error) {
    next(error);
  }
};

exports.deleteTask = async (req, res, next) => {
  try {
    const success = await taskService.deleteTask(req.params.id, req.user.id);
    if (!success) {
      return res.status(404).json({ message: 'Task not found or not owned by user' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};