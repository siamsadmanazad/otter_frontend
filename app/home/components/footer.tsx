"use client"

import { createNewsletter } from "@/app/api/newsletter/newsletter.action";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Facebook, Twitter, Instagram, Youtube, Mail, MapPin, Phone } from "lucide-react"
import Link from "next/link";
import { useActionState } from "react";
import { toast } from "sonner";
import { useEffect } from "react";

const SOCIAL_LINKS = [
  { name: "Facebook", icon: Facebook, href: "/" },
  { name: "Twitter", icon: Twitter, href: "/" },
  { name: "Instagram", icon: Instagram, href: "/" },
  { name: "YouTube", icon: Youtube, href: "/" },
];

const QUICK_LINKS = {
  title: "Quick Links",
  links: [
    { name: "Home", href: "/" },
    { name: "Features", href: "/" },
    { name: "Tribes", href: "/" },
    { name: "Reviews", href: "/" },
    { name: "Issues", href: "/" },
    { name: "About", href: "/" },
  ]
};

const SUPPORT_LINKS = {
  title: "Support",
  links: [
    { name: "Help Center", href: "/" },
    { name: "Contact Us", href: "/" },
    { name: "Privacy Policy", href: "/" },
    { name: "Terms of Service", href: "/" },
    { name: "Community Guidelines", href: "/" },
  ]
};

const CONTACT_INFO = [
  { icon: Mail, value: "hello@tripotter.net" },
  { icon: Phone, value: "+1 (555) 123-4567" },
  { icon: MapPin, value: "Earth, Milkyway" },
];

export function Footer() {
  const [state, formAction] = useActionState(createNewsletter, null);
  useEffect(() => {
    if (state === null) return;
    
    if (state.status) {
      toast.success(state.message);
    } else {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <footer className="bg-foreground text-background py-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          
          {/* Brand Section (Fixed Content) */}
          <div className="lg:col-span-1">
            <h3 className="text-2xl font-black mb-4">TripOtter</h3>
            <p className="text-background/80 mb-6 leading-relaxed">
              The ultimate travel social platform where adventures come alive, friendships bloom, and every journey
              becomes a story worth sharing.
            </p>
            
            {/* Social Links (Mapped from SOCIAL_LINKS) */}
            <div className="flex space-x-4">
              {SOCIAL_LINKS.map((link) => {
                const Icon = link.icon; // Lucide icon component
                return (
                  <Button 
                    key={link.name}
                    variant="ghost" 
                    size="icon" 
                    className="text-background hover:text-foreground hover:bg-background"
                    asChild
                  >
                    <Link href={link.href} aria-label={link.name}>
                      <Icon className="h-5 w-5" />
                    </Link>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Quick Links (Mapped from QUICK_LINKS) */}
          {[QUICK_LINKS, SUPPORT_LINKS].map((section) => (
            <div key={section.title}>
              <h4 className="text-lg font-semibold mb-4">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link 
                      href={link.href} 
                      className="text-background/80 hover:text-background transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Newsletter Form */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Stay Updated</h4>
            <p className="text-background/80 mb-4">
              Get the latest travel tips and platform updates delivered to your inbox.
            </p>
            <form action={formAction} className="space-y-3">
              <Input
                name="email"
                type="email"
                placeholder="Enter your email"
                className="bg-background/10 border-background/20 text-background placeholder:text-background/60"
                required
              />
              <Button 
                type="submit" 
                className="w-full bg-background text-foreground hover:bg-background/90"
              >
                Subscribe
              </Button>
            </form>
          </div>
        </div>

        {/* Contact Info (Mapped from CONTACT_INFO) */}
        <div className="border-t border-background/20 pt-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 justify-between">
            {CONTACT_INFO.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-background/80" />
                  <span className="text-background/80">{item.value}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Copyright (Fixed Content) */}
        <div className="border-t border-background/20 pt-8 text-center">
          <p className="text-background/60">
            © 2025 TripOtter. All rights reserved. Made with ❤️ for travelers worldwide.
          </p>
        </div>
      </div>
    </footer>
  )
}