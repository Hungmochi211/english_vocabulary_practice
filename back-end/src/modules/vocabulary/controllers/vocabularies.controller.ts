import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VocabularyService } from '../services/vocabulary.service';
import { SearchVocabDto } from '../dto/search-vocab.dto';

@ApiTags('Vocabularies (001)')
@Controller('vocabularies')
export class VocabulariesController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  @Get('search')
  async search(@Query() query: SearchVocabDto) {
    return this.vocabularyService.searchVocabularies(query);
  }

  @Get(':id')
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.vocabularyService.findVocabularyById(id);
  }
}
