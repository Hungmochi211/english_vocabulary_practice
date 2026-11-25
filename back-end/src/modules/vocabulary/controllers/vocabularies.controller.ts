import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VocabularyService } from '../services/vocabulary.service';
import { SearchVocabDto } from '../dto/search-vocab.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../common/decorators/current-user.decorator';

@ApiTags('Vocabularies (001 & Saved Words)')
@Controller('vocabularies')
export class VocabulariesController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  @Get('search')
  async search(@Query() query: SearchVocabDto) {
    return this.vocabularyService.searchVocabularies(query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('saved')
  async listSaved(@CurrentUser() user: AuthenticatedUser) {
    return this.vocabularyService.listSavedWords(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/save')
  @HttpCode(HttpStatus.OK)
  async saveWord(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vocabularyService.saveWord(user.id, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/save')
  @HttpCode(HttpStatus.OK)
  async unsaveWord(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vocabularyService.unsaveWord(user.id, id);
  }

  @Get(':id')
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.vocabularyService.findVocabularyById(id);
  }
}
