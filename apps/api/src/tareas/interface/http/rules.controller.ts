import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { RuleDto, UpsertRuleDto } from '@yorga/contracts';
import { JwtPayload } from '../../../auth/application/auth.service';
import { CurrentUser, RequireFeature } from '../../../auth/interface/http/decorators';
import { RulesService } from '../../application/rules.service';

/** Reglas automáticas: las ve quien ve tareas; las cambia quien gestiona proyectos. */
@Controller('rules')
export class RulesController {
  constructor(private readonly rules: RulesService) {}

  @Get()
  @RequireFeature('tareas.ver')
  list(@Query('projectId') projectId?: string): Promise<RuleDto[]> {
    return this.rules.list(projectId && /^\d+$/.test(projectId) ? Number(projectId) : undefined);
  }

  @Post()
  @RequireFeature('proyectos.gestionar')
  create(@Body() body: UpsertRuleDto, @CurrentUser() me: JwtPayload): Promise<RuleDto> {
    return this.rules.create(body, me.sub);
  }

  @Put(':id')
  @RequireFeature('proyectos.gestionar')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpsertRuleDto): Promise<RuleDto> {
    return this.rules.update(id, body);
  }

  @Delete(':id')
  @RequireFeature('proyectos.gestionar')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.rules.remove(id);
  }
}
