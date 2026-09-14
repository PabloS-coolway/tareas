import { Module } from '@nestjs/common';
import { PrismaService } from '../infrastructure/db/prisma.service';
import { ActivityService } from './application/activity.service';
import { AttachmentsService } from './application/attachments.service';
import { CommentsService } from './application/comments.service';
import { ProjectsService } from './application/projects.service';
import { TasksService } from './application/tasks.service';
import { storageProvider } from './infrastructure/storage.provider';
import { AttachmentsController } from './interface/http/attachments.controller';
import { ProjectsController } from './interface/http/projects.controller';
import { CommentsController, TasksController } from './interface/http/tasks.controller';

/** Proyectos, tareas, comentarios, adjuntos y actividad. */
@Module({
  controllers: [ProjectsController, TasksController, CommentsController, AttachmentsController],
  providers: [PrismaService, ActivityService, ProjectsService, TasksService, CommentsService, AttachmentsService, storageProvider],
  exports: [ProjectsService, TasksService, CommentsService, AttachmentsService, ActivityService],
})
export class TareasModule {}
