import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ActivityDto, ActivityFeedItemDto, CommentDto, CreateTaskDto, DependenciesDto, KpisDto, MoveTaskDto, Priority, ResumenDto, TagCountDto, TaskDto, TaskFilter, TaskPageDto, TaskType, UpdateTaskDto } from '@yorga/contracts';
import { JwtPayload } from '../../../auth/application/auth.service';
import { CurrentUser, RequireFeature } from '../../../auth/interface/http/decorators';
import { ActivityService } from '../../application/activity.service';
import { CommentsService } from '../../application/comments.service';
import { TasksService } from '../../application/tasks.service';

/** Los filtros llegan como query string (texto): aquí se tipan. */
function parseFilter(q: Record<string, string | undefined>): TaskFilter {
  const num = (v?: string) => (v && /^-?\d+$/.test(v) ? Number(v) : undefined);
  const assignee = q.assigneeId === 'me' || q.assigneeId === 'none' ? q.assigneeId : num(q.assigneeId);
  return {
    projectId: num(q.projectId),
    statusId: num(q.statusId),
    assigneeId: assignee,
    priority: q.priority as Priority | undefined,
    type: q.type as TaskType | undefined,
    q: q.q,
    parentId: q.parentId === 'null' ? null : num(q.parentId),
    sprintId: q.sprintId === 'none' ? 'none' : num(q.sprintId),
    tag: q.tag,
    overdue: q.overdue === 'true',
    board: q.board === 'true',
    includeDone: q.includeDone === 'true',
    doneDays: num(q.doneDays),
    page: num(q.page),
    pageSize: num(q.pageSize),
  };
}

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly comments: CommentsService,
    private readonly activity: ActivityService,
  ) {}

  @Get()
  @RequireFeature('tareas.ver')
  list(@Query() q: Record<string, string | undefined>, @CurrentUser() me: JwtPayload): Promise<TaskPageDto> {
    return this.tasks.list(parseFilter(q), me.sub);
  }

  @Get('resumen')
  @RequireFeature('tareas.ver')
  resumen(@CurrentUser() me: JwtPayload): Promise<ResumenDto> {
    return this.tasks.resumen(me.sub);
  }

  /** Panel de equipo (KPIs): quien gestione proyectos o usuarios (dirección). */
  @Get('kpis')
  @RequireFeature('proyectos.gestionar', 'usuarios.gestionar')
  kpis(): Promise<KpisDto> {
    return this.tasks.kpis();
  }

  @Get('tags')
  @RequireFeature('tareas.ver')
  tags(@Query('projectId') projectId?: string): Promise<TagCountDto[]> {
    return this.tasks.tags(projectId && /^\d+$/.test(projectId) ? Number(projectId) : undefined);
  }

  /** Lo último que ha pasado en cualquier tarea. */
  @Get('feed')
  @RequireFeature('tareas.ver')
  feed(@Query('limit') limit?: string, @Query('projectId') projectId?: string, @Query('actorId') actorId?: string, @Query('before') before?: string): Promise<ActivityFeedItemDto[]> {
    const num = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
    return this.activity.feed(num(limit) ?? 40, { projectId: num(projectId), actorId: num(actorId), beforeId: num(before) });
  }

  /** Por clave (COOL-12) o por id numérico. */
  @Get(':idOrKey')
  @RequireFeature('tareas.ver')
  get(@Param('idOrKey') idOrKey: string, @CurrentUser() me: JwtPayload): Promise<TaskDto> {
    return /^\d+$/.test(idOrKey) ? this.tasks.get(Number(idOrKey), me.sub) : this.tasks.getByKey(idOrKey, me.sub);
  }

  @Get(':id/subtasks')
  @RequireFeature('tareas.ver')
  subtasks(@Param('id', ParseIntPipe) id: number): Promise<TaskDto[]> {
    return this.tasks.subtasks(id);
  }

  @Post()
  @RequireFeature('tareas.editar')
  create(@Body() body: CreateTaskDto, @CurrentUser() me: JwtPayload): Promise<TaskDto> {
    return this.tasks.create(body, me.sub);
  }

  @Patch(':id')
  @RequireFeature('tareas.editar')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateTaskDto, @CurrentUser() me: JwtPayload): Promise<TaskDto> {
    return this.tasks.update(id, body, me.sub);
  }

  // ---- dependencias ----

  @Get(':id/dependencies')
  @RequireFeature('tareas.ver')
  dependencies(@Param('id', ParseIntPipe) id: number): Promise<DependenciesDto> {
    return this.tasks.dependencies(id);
  }

  @Post(':id/dependencies')
  @RequireFeature('tareas.editar')
  addDependency(@Param('id', ParseIntPipe) id: number, @Body() body: { blocker: string }, @CurrentUser() me: JwtPayload): Promise<DependenciesDto> {
    return this.tasks.addDependency(id, String(body?.blocker ?? '').trim(), me.sub);
  }

  @Delete(':id/dependencies/:blockerId')
  @RequireFeature('tareas.editar')
  removeDependency(@Param('id', ParseIntPipe) id: number, @Param('blockerId', ParseIntPipe) blockerId: number, @CurrentUser() me: JwtPayload): Promise<DependenciesDto> {
    return this.tasks.removeDependency(id, blockerId, me.sub);
  }

  @Post(':id/duplicate')
  @RequireFeature('tareas.editar')
  duplicate(@Param('id', ParseIntPipe) id: number, @CurrentUser() me: JwtPayload): Promise<TaskDto> {
    return this.tasks.duplicate(id, me.sub);
  }

  @Post(':id/move')
  @RequireFeature('tareas.editar')
  move(@Param('id', ParseIntPipe) id: number, @Body() body: MoveTaskDto, @CurrentUser() me: JwtPayload): Promise<TaskDto> {
    return this.tasks.move(id, body, me.sub);
  }

  @Delete(':id')
  @RequireFeature('tareas.borrar')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tasks.remove(id);
  }

  // ---- comentarios y actividad de una tarea ----

  @Get(':id/comments')
  @RequireFeature('tareas.ver')
  listComments(@Param('id', ParseIntPipe) id: number): Promise<CommentDto[]> {
    return this.comments.list(id);
  }

  @Post(':id/comments')
  @RequireFeature('tareas.editar')
  addComment(@Param('id', ParseIntPipe) id: number, @Body() body: { body: string }, @CurrentUser() me: JwtPayload): Promise<CommentDto> {
    return this.comments.add(id, body?.body ?? '', me.sub);
  }

  @Get(':id/activity')
  @RequireFeature('tareas.ver')
  listActivity(@Param('id', ParseIntPipe) id: number): Promise<ActivityDto[]> {
    return this.activity.list(id);
  }
}

@Controller('comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Patch(':id')
  @RequireFeature('tareas.editar')
  edit(@Param('id', ParseIntPipe) id: number, @Body() body: { body: string }, @CurrentUser() me: JwtPayload): Promise<CommentDto> {
    return this.comments.edit(id, body?.body ?? '', me.sub, me.role === 'admin');
  }

  @Delete(':id')
  @RequireFeature('tareas.editar')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() me: JwtPayload): Promise<void> {
    return this.comments.remove(id, me.sub, me.role === 'admin');
  }
}
