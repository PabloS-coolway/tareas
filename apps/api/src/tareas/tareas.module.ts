import { Module } from '@nestjs/common';
import { PrismaService } from '../infrastructure/db/prisma.service';
import { ActivityService } from './application/activity.service';
import { AccessService } from './application/access.service';
import { TeamsService } from './application/teams.service';
import { TeamsController } from './interface/http/teams.controller';
import { AttachmentsService } from './application/attachments.service';
import { CommentsService } from './application/comments.service';
import { ProjectsService } from './application/projects.service';
import { NotificationsService } from './application/notifications.service';
import { SprintsService } from './application/sprints.service';
import { TemplatesService } from './application/templates.service';
import { ViewsService } from './application/views.service';
import { TasksService } from './application/tasks.service';
import { RulesService } from './application/rules.service';
import { RulesController } from './interface/http/rules.controller';
import { IntakeService } from './application/intake.service';
import { IntakeController, PublicFormController } from './interface/http/intake.controller';
import { GithubService } from './application/github.service';
import { GithubController } from './interface/http/github.controller';
import { storageProvider } from './infrastructure/storage.provider';
import { AttachmentsController } from './interface/http/attachments.controller';
import { ProjectsController } from './interface/http/projects.controller';
import { NotificationsController } from './interface/http/notifications.controller';
import { SprintsController } from './interface/http/sprints.controller';
import { TemplatesController } from './interface/http/templates.controller';
import { ViewsController } from './interface/http/views.controller';
import { CommentsController, TasksController } from './interface/http/tasks.controller';

/** Proyectos, tareas, comentarios, adjuntos y actividad. */
@Module({
  controllers: [ProjectsController, TeamsController, SprintsController, TasksController, CommentsController, AttachmentsController, NotificationsController, ViewsController, TemplatesController, RulesController, IntakeController, PublicFormController, GithubController],
  providers: [PrismaService, AccessService, TeamsService, ActivityService, NotificationsService, ViewsService, TemplatesService, ProjectsService, SprintsService, TasksService, RulesService, IntakeService, GithubService, CommentsService, AttachmentsService, storageProvider],
  exports: [AccessService, TeamsService, ProjectsService, SprintsService, TasksService, NotificationsService, TemplatesService, CommentsService, AttachmentsService, ActivityService],
})
export class TareasModule {}
