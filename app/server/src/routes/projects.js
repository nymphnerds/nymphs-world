import express from 'express';
import {
  createProject,
  getActiveProject,
  listProjects,
  setActiveProject,
} from '../services/projectService.js';

const router = express.Router();

function publicProject(project) {
  return {
    id: project.id,
    title: project.title,
    schema: project.schema,
    format: project.format,
    features: project.features,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    rootPath: project.rootPath,
  };
}

// GET /api/projects - list projects and current active project
router.get('/', (req, res) => {
  try {
    const username = req.user.username;
    const activeProject = getActiveProject(username);
    const projects = listProjects();
    res.json({
      activeProject: publicProject(activeProject),
      projects: projects.map(publicProject),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/projects/active - return current active project, creating the default if needed
router.get('/active', (req, res) => {
  try {
    const project = getActiveProject(req.user.username);
    res.json({ activeProject: publicProject(project) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/projects - create project and make it active
router.post('/', (req, res) => {
  try {
    const username = req.user.username;
    const { id, title } = req.body || {};
    const project = createProject(username, { id, title });
    res.json({ success: true, activeProject: publicProject(project) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/projects/active - select an existing project
router.post('/active', (req, res) => {
  try {
    const username = req.user.username;
    const { id } = req.body || {};
    if (!id) {
      return res.status(400).json({ error: 'Project id is required' });
    }
    const project = setActiveProject(username, id);
    res.json({ success: true, activeProject: publicProject(project) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
