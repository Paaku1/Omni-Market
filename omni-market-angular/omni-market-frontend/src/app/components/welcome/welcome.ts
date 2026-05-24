import { Component, OnInit } from '@angular/core';
import { Auth } from '../../core/services/auth';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './welcome.html',
  styleUrls: ['./welcome.scss']
})
export class Welcome implements OnInit {
  constructor(public readonly authService: Auth) {}

  ngOnInit(): void {}
}
