const express = require('express');
const requireAdmin = require('../middleware/adminAuth');
const Sprint = require('../models/Sprint');
const Task = require('../models/Task');
const User = require('../models/User');

const router = express.Router();

// Apply requireAdmin middleware to protect all routes
router.use(requireAdmin);

// GET /api/admin/tasks - Retrieve tasks, sprints, and users (members)
router.get('/', async (request, response) => {
  try {
    const tasks = await Task.find()
      .populate('sprintId', 'name startDate endDate')
      .populate('assigneeId', 'name email role')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 });

    const sprints = await Sprint.find().sort({ name: 1 });
    const users = await User.find().select('name email role').sort({ name: 1 });

    response.json({
      success: true,
      tasks,
      sprints,
      users,
    });
  } catch (error) {
    console.error('Error fetching tasks data:', error);
    response.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách Task.' });
  }
});

// POST /api/admin/tasks - Create a new Task
router.post('/', async (request, response) => {
  const { sprintId, title, description, assigneeId } = request.body ?? {};

  if (!sprintId || !title) {
    response.status(400).json({ success: false, message: 'Sprint và Tên Task là bắt buộc.' });
    return;
  }

  try {
    const newTask = await Task.create({
      sprintId,
      title,
      description: description || '',
      assigneeId: assigneeId || null,
      updatedBy: request.admin._id,
    });

    const populated = await Task.findById(newTask._id)
      .populate('sprintId', 'name startDate endDate')
      .populate('assigneeId', 'name email role')
      .populate('updatedBy', 'name email');

    response.status(201).json({
      success: true,
      task: populated,
    });
  } catch (error) {
    console.error('Error creating task:', error);
    response.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo Task.' });
  }
});

// PUT /api/admin/tasks/:id - Update an existing Task
router.put('/:id', async (request, response) => {
  const { id } = request.params;
  const { sprintId, title, description, assigneeId } = request.body ?? {};

  try {
    const updateData = {
      updatedBy: request.admin._id,
    };

    if (sprintId !== undefined) updateData.sprintId = sprintId;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId || null;

    const updatedTask = await Task.findByIdAndUpdate(id, updateData, { new: true })
      .populate('sprintId', 'name startDate endDate')
      .populate('assigneeId', 'name email role')
      .populate('updatedBy', 'name email');

    if (!updatedTask) {
      response.status(404).json({ success: false, message: 'Không tìm thấy Task để cập nhật.' });
      return;
    }

    response.json({
      success: true,
      task: updatedTask,
    });
  } catch (error) {
    console.error('Error updating task:', error);
    response.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật Task.' });
  }
});

// POST /api/admin/tasks/sprints - Create a new Sprint
router.post('/sprints', async (request, response) => {
  const { name, startDate, endDate } = request.body ?? {};

  if (!name) {
    response.status(400).json({ success: false, message: 'Tên Sprint là bắt buộc.' });
    return;
  }

  try {
    const newSprint = await Sprint.create({
      name,
      startDate: startDate || null,
      endDate: endDate || null,
    });

    response.status(201).json({
      success: true,
      sprint: newSprint,
    });
  } catch (error) {
    console.error('Error creating sprint:', error);
    response.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo Sprint.' });
  }
});

module.exports = router;
